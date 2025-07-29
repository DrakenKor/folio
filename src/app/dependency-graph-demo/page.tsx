'use client'

import React, { useState } from 'react'
import DependencyGraph3D from '../../components/DependencyGraph3D'
import { CodeNode } from '../../types/code-architecture'

export default function DependencyGraphDemo() {
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<CodeNode | null>(null)

  const handleNodeSelect = (node: CodeNode) => {
    console.log('Selected node:', node)
    setSelectedNode(node)
  }

  const handleNodeHover = (node: CodeNode | null) => {
    setHoveredNode(node)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            3D Dependency Graph Visualization
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Interactive 3D visualization of project architectures and dependencies.
            Click on nodes to see detailed information, hover to highlight connections.
          </p>

          {/* Instructions */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">How to Use</h2>
            <ul className="space-y-2 text-gray-600">
              <li>• <strong>Click and drag</strong> to rotate the view</li>
              <li>• <strong>Scroll</strong> to zoom in/out</li>
              <li>• <strong>Click nodes</strong> to see detailed information</li>
              <li>• <strong>Hover nodes</strong> to highlight connections</li>
              <li>• <strong>Use dropdown</strong> to switch between projects</li>
            </ul>
          </div>

          {/* Current selection info */}
          {selectedNode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Selected: {selectedNode.name}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Type:</span>
                  <span className="ml-2 text-blue-600">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Size:</span>
                  <span className="ml-2 text-blue-600">{selectedNode.size} LOC</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Dependencies:</span>
                  <span className="ml-2 text-blue-600">{selectedNode.dependencies.length}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Technologies:</span>
                  <span className="ml-2 text-blue-600">{selectedNode.metadata.technologies.length}</span>
                </div>
              </div>
            </div>
          )}

          {hoveredNode && hoveredNode.id !== selectedNode?.id && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-yellow-800">
                <strong>Hovering:</strong> {hoveredNode.name} ({hoveredNode.type})
              </p>
            </div>
          )}
        </div>

        {/* 3D Visualization */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="h-[600px]">
            <DependencyGraph3D
              onNodeSelect={handleNodeSelect}
              onNodeHover={handleNodeHover}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Legend</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Node Types */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Node Types</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                  <span><strong>Cube:</strong> Service/Module</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                  <span><strong>Sphere:</strong> Component</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-purple-500 mr-3" style={{clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'}}></div>
                  <span><strong>Octahedron:</strong> API</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-500 mr-3" style={{borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%'}}></div>
                  <span><strong>Cylinder:</strong> Database</span>
                </div>
              </div>
            </div>

            {/* Edge Types */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Connection Types</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-blue-500 mr-3"></div>
                  <span><strong>Blue:</strong> Dependency</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-green-500 mr-3"></div>
                  <span><strong>Green:</strong> Data Flow</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-red-500 mr-3"></div>
                  <span><strong>Red:</strong> Function Call</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-purple-500 mr-3"></div>
                  <span><strong>Purple:</strong> Inheritance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
