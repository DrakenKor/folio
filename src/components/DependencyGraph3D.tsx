'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { CodeGraph, CodeNode, CodeEdge, NodeType } from '../types/code-architecture'
import { CodeArchitectureService } from '../lib/code-architecture/code-architecture-service'

interface DependencyGraph3DProps {
  projectId?: string
  onNodeSelect?: (node: CodeNode) => void
  onNodeHover?: (node: CodeNode | null) => void
  className?: string
}

interface NodeMeshProps {
  node: CodeNode
  isSelected: boolean
  isHovered: boolean
  onClick: (node: CodeNode) => void
  onHover: (node: CodeNode | null) => void
}

interface EdgeMeshProps {
  edge: CodeEdge
  sourcePosition: THREE.Vector3
  targetPosition: THREE.Vector3
  isHighlighted: boolean
}

const NodeMesh: React.FC<NodeMeshProps> = ({
  node,
  isSelected,
  isHovered,
  onClick,
  onHover
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = node.position3D.y + Math.sin(state.clock.elapsedTime + node.position3D.x) * 0.1

      // Scale animation for selection/hover
      const targetScale = isSelected ? 1.3 : (isHovered || hovered ? 1.1 : 1)
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    }
  })

  const getNodeGeometry = () => {
    switch (node.type) {
      case NodeType.DATABASE:
        return <cylinderGeometry args={[0.8, 0.8, 0.4, 8]} />
      case NodeType.API:
        return <octahedronGeometry args={[0.8]} />
      case NodeType.SERVICE:
        return <boxGeometry args={[1.2, 0.8, 0.8]} />
      case NodeType.COMPONENT:
        return <sphereGeometry args={[0.7]} />
      case NodeType.MODULE:
        return <dodecahedronGeometry args={[0.8]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }

  const getNodeColor = () => {
    if (isSelected) return '#ffffff'
    if (isHovered || hovered) return '#ffff00'
    return node.color || '#4a90e2'
  }

  const getNodeSize = () => {
    // Size based on node importance (number of dependencies + size)
    const baseSize = Math.max(0.5, Math.min(2, node.size / 100))
    const dependencyBonus = Math.min(0.5, node.dependencies.length * 0.1)
    return baseSize + dependencyBonus
  }

  return (
    <group position={[node.position3D.x, node.position3D.y, node.position3D.z]}>
      <mesh
        ref={meshRef}
        onClick={() => onClick(node)}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          onHover(node)
        }}
        onPointerOut={() => {
          setHovered(false)
          onHover(null)
        }}
        scale={getNodeSize()}
      >
        {getNodeGeometry()}
        <meshStandardMaterial
          color={getNodeColor()}
          metalness={0.3}
          roughness={0.4}
          emissive={isSelected ? '#333333' : '#000000'}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Node label */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.3}
        color={isSelected ? '#ffffff' : '#333333'}
        anchorX="center"
        anchorY="middle"
        maxWidth={3}
        textAlign="center"
      >
        {node.name}
      </Text>

      {/* Technology badges */}
      {node.metadata.technologies.slice(0, 3).map((tech, index) => (
        <Text
          key={tech}
          position={[0, -1.2 - (index * 0.3), 0]}
          fontSize={0.15}
          color="#666666"
          anchorX="center"
          anchorY="middle"
        >
          {tech}
        </Text>
      ))}
    </group>
  )
}

const EdgeMesh: React.FC<EdgeMeshProps> = ({
  edge,
  sourcePosition,
  targetPosition,
  isHighlighted
}) => {
  const lineRef = useRef<THREE.BufferGeometry>(null)

  useEffect(() => {
    if (lineRef.current) {
      const points = [sourcePosition, targetPosition]
      lineRef.current.setFromPoints(points)
    }
  }, [sourcePosition, targetPosition])

  const getEdgeColor = () => {
    if (isHighlighted) return '#ffff00'

    switch (edge.type) {
      case 'dependency':
        return '#4a90e2'
      case 'data_flow':
        return '#50c878'
      case 'call':
        return '#ff6b6b'
      case 'inheritance':
        return '#9b59b6'
      default:
        return '#95a5a6'
    }
  }

  const getEdgeWidth = () => {
    return Math.max(0.02, edge.weight * 0.05)
  }

  return (
    <line>
      <bufferGeometry ref={lineRef} />
      <lineBasicMaterial
        color={getEdgeColor()}
        linewidth={getEdgeWidth()}
        transparent
        opacity={isHighlighted ? 1 : 0.6}
      />
    </line>
  )
}

const Graph3DScene: React.FC<{
  graph: CodeGraph
  selectedNode: CodeNode | null
  hoveredNode: CodeNode | null
  onNodeSelect: (node: CodeNode) => void
  onNodeHover: (node: CodeNode | null) => void
}> = ({ graph, selectedNode, hoveredNode, onNodeSelect, onNodeHover }) => {
  const { camera } = useThree()

  useEffect(() => {
    // Position camera to view the entire graph
    if (graph.nodes.length > 0) {
      const bounds = graph.layout.bounds
      const center = new THREE.Vector3(
        (bounds.max.x + bounds.min.x) / 2,
        (bounds.max.y + bounds.min.y) / 2,
        (bounds.max.z + bounds.min.z) / 2
      )

      const size = Math.max(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
        bounds.max.z - bounds.min.z
      )

      camera.position.set(center.x, center.y, center.z + size * 1.5)
      camera.lookAt(center)
    }
  }, [graph, camera])

  const getHighlightedEdges = () => {
    if (!selectedNode) return new Set<string>()

    const highlighted = new Set<string>()
    graph.edges.forEach(edge => {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        highlighted.add(edge.id)
      }
    })
    return highlighted
  }

  const highlightedEdges = getHighlightedEdges()

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />

      {/* Nodes */}
      {graph.nodes.map(node => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isHovered={hoveredNode?.id === node.id}
          onClick={onNodeSelect}
          onHover={onNodeHover}
        />
      ))}

      {/* Edges */}
      {graph.edges.map(edge => {
        const sourceNode = graph.nodes.find(n => n.id === edge.source)
        const targetNode = graph.nodes.find(n => n.id === edge.target)

        if (!sourceNode || !targetNode) return null

        return (
          <EdgeMesh
            key={edge.id}
            edge={edge}
            sourcePosition={sourceNode.position3D}
            targetPosition={targetNode.position3D}
            isHighlighted={highlightedEdges.has(edge.id)}
          />
        )
      })}

      {/* Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={100}
        minDistance={5}
      />
    </>
  )
}

const NodeInfoPanel: React.FC<{
  node: CodeNode | null
  onClose: () => void
}> = ({ node, onClose }) => {
  if (!node) return null

  return (
    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-sm">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{node.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium text-gray-600">Type:</span>
          <span className="ml-2 text-gray-800">{node.type}</span>
        </div>

        <div>
          <span className="font-medium text-gray-600">Size:</span>
          <span className="ml-2 text-gray-800">{node.size} LOC</span>
        </div>

        {node.metadata.description && (
          <div>
            <span className="font-medium text-gray-600">Description:</span>
            <p className="mt-1 text-gray-800">{node.metadata.description}</p>
          </div>
        )}

        {node.metadata.technologies.length > 0 && (
          <div>
            <span className="font-medium text-gray-600">Technologies:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {node.metadata.technologies.map(tech => (
                <span
                  key={tech}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.dependencies.length > 0 && (
          <div>
            <span className="font-medium text-gray-600">Dependencies:</span>
            <span className="ml-2 text-gray-800">{node.dependencies.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export const DependencyGraph3D: React.FC<DependencyGraph3DProps> = ({
  projectId,
  onNodeSelect,
  onNodeHover,
  className = ''
}) => {
  const [selectedProject, setSelectedProject] = useState<CodeGraph | null>(null)
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<CodeNode | null>(null)
  const [availableProjects, setAvailableProjects] = useState<CodeGraph[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const service = CodeArchitectureService.getInstance()
    const projects = service.getProjectGraphs()
    setAvailableProjects(projects)

    if (projectId) {
      const project = service.getProjectGraph(projectId)
      setSelectedProject(project || null)
    } else if (projects.length > 0) {
      setSelectedProject(projects[0])
    }

    setIsLoading(false)
  }, [projectId])

  const handleNodeSelect = useCallback((node: CodeNode) => {
    setSelectedNode(node)
    onNodeSelect?.(node)
  }, [onNodeSelect])

  const handleNodeHover = useCallback((node: CodeNode | null) => {
    setHoveredNode(node)
    onNodeHover?.(node)
  }, [onNodeHover])

  const handleProjectChange = (projectId: string) => {
    const service = CodeArchitectureService.getInstance()
    const project = service.getProjectGraph(projectId)
    setSelectedProject(project || null)
    setSelectedNode(null)
    setHoveredNode(null)
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dependency graph...</p>
        </div>
      </div>
    )
  }

  if (!selectedProject) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <p className="text-gray-600 mb-4">No project data available</p>
          <p className="text-sm text-gray-500">Please check your project configuration</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Project selector */}
      <div className="absolute top-4 left-4 z-10">
        <select
          value={selectedProject.id}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm"
        >
          {availableProjects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Graph statistics */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm text-sm">
        <div className="space-y-1">
          <div>Nodes: <span className="font-medium">{selectedProject.nodes.length}</span></div>
          <div>Edges: <span className="font-medium">{selectedProject.edges.length}</span></div>
          <div>Architecture: <span className="font-medium">{selectedProject.metadata.architecture}</span></div>
        </div>
      </div>

      {/* Node information panel */}
      <NodeInfoPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 20], fov: 75 }}
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <Graph3DScene
          graph={selectedProject}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          onNodeSelect={handleNodeSelect}
          onNodeHover={handleNodeHover}
        />
      </Canvas>
    </div>
  )
}

export default DependencyGraph3D
