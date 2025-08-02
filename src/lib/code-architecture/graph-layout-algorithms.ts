import { Vector3 } from 'three'
import { CodeNode, CodeEdge, LayoutAlgorithm, LayoutParameters } from '../../types/code-architecture'

export class GraphLayoutAlgorithms {
  static applyLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    algorithm: LayoutAlgorithm,
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    switch (algorithm) {
      case LayoutAlgorithm.FORCE_DIRECTED:
        this.applyForceDirectedLayout(nodes, edges, parameters, bounds)
        break
      case LayoutAlgorithm.HIERARCHICAL:
        this.applyHierarchicalLayout(nodes, edges, parameters, bounds)
        break
      case LayoutAlgorithm.CIRCULAR:
        this.applyCircularLayout(nodes, edges, parameters, bounds)
        break
      case LayoutAlgorithm.TREE:
        this.applyTreeLayout(nodes, edges, parameters, bounds)
        break
      case LayoutAlgorithm.GRID:
        this.applyGridLayout(nodes, edges, parameters, bounds)
        break
      default:
        this.applyForceDirectedLayout(nodes, edges, parameters, bounds)
    }
  }

  private static applyForceDirectedLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    const { nodeSpacing, edgeLength, repulsionStrength, attractionStrength, iterations } = parameters

    // Initialize random positions if not set
    nodes.forEach(node => {
      if (!node.position3D) {
        node.position3D = new Vector3(
          (Math.random() - 0.5) * (bounds.max.x - bounds.min.x),
          (Math.random() - 0.5) * (bounds.max.y - bounds.min.y),
          (Math.random() - 0.5) * (bounds.max.z - bounds.min.z)
        )
      }
    })

    // Create adjacency map for faster edge lookups
    const adjacencyMap = new Map<string, string[]>()
    edges.forEach(edge => {
      if (!adjacencyMap.has(edge.source)) {
        adjacencyMap.set(edge.source, [])
      }
      if (!adjacencyMap.has(edge.target)) {
        adjacencyMap.set(edge.target, [])
      }
      adjacencyMap.get(edge.source)!.push(edge.target)
      adjacencyMap.get(edge.target)!.push(edge.source)
    })

    // Force-directed algorithm iterations
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, Vector3>()

      // Initialize forces
      nodes.forEach(node => {
        forces.set(node.id, new Vector3(0, 0, 0))
      })

      // Calculate repulsive forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i]
          const nodeB = nodes[j]

          const distance = nodeA.position3D.distanceTo(nodeB.position3D)
          if (distance < 0.1) continue // Avoid division by zero

          const repulsiveForce = repulsionStrength / (distance * distance)
          const direction = new Vector3()
            .subVectors(nodeA.position3D, nodeB.position3D)
            .normalize()

          const forceVector = direction.multiplyScalar(repulsiveForce)
          forces.get(nodeA.id)!.add(forceVector)
          forces.get(nodeB.id)!.sub(forceVector)
        }
      }

      // Calculate attractive forces for connected nodes
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)

        if (!sourceNode || !targetNode) return

        const distance = sourceNode.position3D.distanceTo(targetNode.position3D)
        const attractiveForce = attractionStrength * (distance - edgeLength) * edge.weight

        const direction = new Vector3()
          .subVectors(targetNode.position3D, sourceNode.position3D)
          .normalize()

        const forceVector = direction.multiplyScalar(attractiveForce)
        forces.get(sourceNode.id)!.add(forceVector)
        forces.get(targetNode.id)!.sub(forceVector)
      })

      // Apply forces with damping
      const damping = 0.9
      nodes.forEach(node => {
        const force = forces.get(node.id)!
        force.multiplyScalar(damping)
        node.position3D.add(force)

        // Keep nodes within bounds
        node.position3D.clamp(bounds.min, bounds.max)
      })
    }
  }

  private static applyHierarchicalLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    // Build dependency hierarchy
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    const adjacencyList = new Map<string, string[]>()

    nodes.forEach(node => {
      inDegree.set(node.id, 0)
      outDegree.set(node.id, 0)
      adjacencyList.set(node.id, [])
    })

    edges.forEach(edge => {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
      outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1)
      adjacencyList.get(edge.source)!.push(edge.target)
    })

    // Topological sort to determine hierarchy levels
    const levels: string[][] = []
    const queue: string[] = []
    const tempInDegree = new Map(inDegree)

    // Find nodes with no incoming edges (root nodes)
    nodes.forEach(node => {
      if (tempInDegree.get(node.id) === 0) {
        queue.push(node.id)
      }
    })

    while (queue.length > 0) {
      const currentLevel: string[] = []
      const levelSize = queue.length

      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!
        currentLevel.push(nodeId)

        // Process neighbors
        adjacencyList.get(nodeId)!.forEach(neighbor => {
          const newInDegree = tempInDegree.get(neighbor)! - 1
          tempInDegree.set(neighbor, newInDegree)
          if (newInDegree === 0) {
            queue.push(neighbor)
          }
        })
      }

      levels.push(currentLevel)
    }

    // Position nodes in hierarchy
    const levelHeight = (bounds.max.y - bounds.min.y) / Math.max(levels.length - 1, 1)

    levels.forEach((level, levelIndex) => {
      const y = bounds.max.y - levelIndex * levelHeight
      const levelWidth = (bounds.max.x - bounds.min.x) / Math.max(level.length - 1, 1)

      level.forEach((nodeId, nodeIndex) => {
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          const x = bounds.min.x + nodeIndex * levelWidth
          const z = (Math.random() - 0.5) * (bounds.max.z - bounds.min.z) * 0.3
          node.position3D = new Vector3(x, y, z)
        }
      })
    })
  }

  private static applyCircularLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    const radius = Math.min(
      (bounds.max.x - bounds.min.x) / 2,
      (bounds.max.z - bounds.min.z) / 2
    ) * 0.8

    const center = new Vector3(
      (bounds.max.x + bounds.min.x) / 2,
      (bounds.max.y + bounds.min.y) / 2,
      (bounds.max.z + bounds.min.z) / 2
    )

    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2
      const x = center.x + Math.cos(angle) * radius
      const z = center.z + Math.sin(angle) * radius
      const y = center.y + (Math.random() - 0.5) * (bounds.max.y - bounds.min.y) * 0.2

      node.position3D = new Vector3(x, y, z)
    })
  }

  private static applyTreeLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    // Find root nodes (nodes with no incoming edges)
    const incomingEdges = new Set<string>()
    edges.forEach(edge => incomingEdges.add(edge.target))

    const rootNodes = nodes.filter(node => !incomingEdges.has(node.id))
    if (rootNodes.length === 0) {
      // Fallback to first node if no clear root
      rootNodes.push(nodes[0])
    }

    // Build tree structure
    const children = new Map<string, string[]>()
    nodes.forEach(node => children.set(node.id, []))

    edges.forEach(edge => {
      children.get(edge.source)!.push(edge.target)
    })

    // Position nodes using recursive tree layout
    const visited = new Set<string>()
    let currentX = bounds.min.x

    rootNodes.forEach(rootNode => {
      this.positionTreeNode(
        rootNode,
        nodes,
        children,
        visited,
        bounds.max.y,
        currentX,
        bounds,
        parameters.nodeSpacing
      )
      currentX += (bounds.max.x - bounds.min.x) / rootNodes.length
    })
  }

  private static positionTreeNode(
    node: CodeNode,
    nodes: CodeNode[],
    children: Map<string, string[]>,
    visited: Set<string>,
    y: number,
    x: number,
    bounds: { min: Vector3; max: Vector3 },
    nodeSpacing: number
  ): number {
    if (visited.has(node.id)) return x

    visited.add(node.id)
    node.position3D = new Vector3(x, y, (Math.random() - 0.5) * (bounds.max.z - bounds.min.z) * 0.3)

    const nodeChildren = children.get(node.id) || []
    let childX = x - (nodeChildren.length - 1) * nodeSpacing / 2

    nodeChildren.forEach(childId => {
      const childNode = nodes.find(n => n.id === childId)
      if (childNode && !visited.has(childId)) {
        childX = this.positionTreeNode(
          childNode,
          nodes,
          children,
          visited,
          y - nodeSpacing,
          childX,
          bounds,
          nodeSpacing
        )
        childX += nodeSpacing
      }
    })

    return x + nodeSpacing
  }

  private static applyGridLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters,
    bounds: { min: Vector3; max: Vector3 }
  ): void {
    const gridSize = Math.ceil(Math.sqrt(nodes.length))
    const cellWidth = (bounds.max.x - bounds.min.x) / gridSize
    const cellHeight = (bounds.max.z - bounds.min.z) / gridSize

    nodes.forEach((node, index) => {
      const row = Math.floor(index / gridSize)
      const col = index % gridSize

      const x = bounds.min.x + col * cellWidth + cellWidth / 2
      const z = bounds.min.z + row * cellHeight + cellHeight / 2
      const y = (bounds.max.y + bounds.min.y) / 2 + (Math.random() - 0.5) * parameters.nodeSpacing

      node.position3D = new Vector3(x, y, z)
    })
  }

  static optimizeLayout(
    nodes: CodeNode[],
    edges: CodeEdge[],
    parameters: LayoutParameters
  ): void {
    // Post-processing optimization to reduce edge crossings and improve readability

    // Calculate current layout quality score
    let crossings = this.countEdgeCrossings(nodes, edges)
    let bestCrossings = crossings
    const bestPositions = nodes.map(node => node.position3D.clone())

    // Try small perturbations to improve layout
    for (let iteration = 0; iteration < 100; iteration++) {
      // Randomly select a node to move
      const nodeIndex = Math.floor(Math.random() * nodes.length)
      const node = nodes[nodeIndex]
      const originalPosition = node.position3D.clone()

      // Try a small random movement
      const perturbation = new Vector3(
        (Math.random() - 0.5) * parameters.nodeSpacing * 0.5,
        (Math.random() - 0.5) * parameters.nodeSpacing * 0.5,
        (Math.random() - 0.5) * parameters.nodeSpacing * 0.5
      )

      node.position3D.add(perturbation)

      // Check if this improves the layout
      const newCrossings = this.countEdgeCrossings(nodes, edges)

      if (newCrossings < bestCrossings) {
        bestCrossings = newCrossings
        bestPositions[nodeIndex] = node.position3D.clone()
      } else {
        // Revert the change
        node.position3D.copy(originalPosition)
      }
    }

    // Apply best positions
    nodes.forEach((node, index) => {
      node.position3D.copy(bestPositions[index])
    })
  }

  private static countEdgeCrossings(nodes: CodeNode[], edges: CodeEdge[]): number {
    let crossings = 0

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const edge1 = edges[i]
        const edge2 = edges[j]

        const node1a = nodes.find(n => n.id === edge1.source)
        const node1b = nodes.find(n => n.id === edge1.target)
        const node2a = nodes.find(n => n.id === edge2.source)
        const node2b = nodes.find(n => n.id === edge2.target)

        if (node1a && node1b && node2a && node2b) {
          if (this.doEdgesCross(node1a.position3D, node1b.position3D, node2a.position3D, node2b.position3D)) {
            crossings++
          }
        }
      }
    }

    return crossings
  }

  private static doEdgesCross(p1: Vector3, p2: Vector3, p3: Vector3, p4: Vector3): boolean {
    // Simplified 2D crossing check using x and z coordinates
    const x1 = p1.x, z1 = p1.z
    const x2 = p2.x, z2 = p2.z
    const x3 = p3.x, z3 = p3.z
    const x4 = p4.x, z4 = p4.z

    const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4)
    if (Math.abs(denom) < 0.0001) return false // Parallel lines

    const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom
    const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / denom

    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }
}
