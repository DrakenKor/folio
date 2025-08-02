import { CodeGraph, TechnologyMigration, FileTreeNode } from '../../types/code-architecture'
import { MockDataGenerator } from './mock-data-generator'
import { GraphLayoutAlgorithms } from './graph-layout-algorithms'

export class CodeArchitectureService {
  private static instance: CodeArchitectureService
  private projectGraphs: CodeGraph[] = []
  private technologyMigrations: TechnologyMigration[] = []
  private fileTrees: Map<string, FileTreeNode> = new Map()

  private constructor() {
    this.initializeData()
  }

  static getInstance(): CodeArchitectureService {
    if (!CodeArchitectureService.instance) {
      CodeArchitectureService.instance = new CodeArchitectureService()
    }
    return CodeArchitectureService.instance
  }

  private initializeData(): void {
    // Load project graphs
    this.projectGraphs = MockDataGenerator.generateProjectGraphs()

    // Apply layout algorithms to each graph
    this.projectGraphs.forEach(graph => {
      GraphLayoutAlgorithms.applyLayout(
        graph.nodes,
        graph.edges,
        graph.layout.algorithm,
        graph.layout.parameters,
        graph.layout.bounds
      )

      // Optimize the layout
      GraphLayoutAlgorithms.optimizeLayout(
        graph.nodes,
        graph.edges,
        graph.layout.parameters
      )
    })

    // Load technology migrations
    this.technologyMigrations = MockDataGenerator.generateTechnologyMigrations()

    // Generate file trees for each project
    this.projectGraphs.forEach(graph => {
      const fileTree = MockDataGenerator.generateFileTree(graph.id)
      this.fileTrees.set(graph.id, fileTree)
    })
  }

  getProjectGraphs(): CodeGraph[] {
    return this.projectGraphs
  }

  getProjectGraph(projectId: string): CodeGraph | undefined {
    return this.projectGraphs.find(graph => graph.id === projectId)
  }

  getTechnologyMigrations(): TechnologyMigration[] {
    return this.technologyMigrations
  }

  getTechnologyMigration(migrationId: string): TechnologyMigration | undefined {
    return this.technologyMigrations.find(migration => migration.id === migrationId)
  }

  getFileTree(projectId: string): FileTreeNode | undefined {
    return this.fileTrees.get(projectId)
  }

  getProjectsByTechnology(technology: string): CodeGraph[] {
    return this.projectGraphs.filter(graph =>
      graph.metadata.technologies.some(tech =>
        tech.toLowerCase().includes(technology.toLowerCase())
      )
    )
  }

  getProjectsByArchitecture(architecture: string): CodeGraph[] {
    return this.projectGraphs.filter(graph =>
      graph.metadata.architecture.toLowerCase().includes(architecture.toLowerCase())
    )
  }

  getProjectsByTimeRange(startDate: Date, endDate: Date): CodeGraph[] {
    return this.projectGraphs.filter(graph => {
      const projectStart = graph.metadata.startDate
      const projectEnd = graph.metadata.endDate || new Date()

      return (
        (projectStart >= startDate && projectStart <= endDate) ||
        (projectEnd >= startDate && projectEnd <= endDate) ||
        (projectStart <= startDate && projectEnd >= endDate)
      )
    })
  }

  searchNodes(query: string): { graph: CodeGraph; nodes: any[] }[] {
    const results: { graph: CodeGraph; nodes: any[] }[] = []

    this.projectGraphs.forEach(graph => {
      const matchingNodes = graph.nodes.filter(node =>
        node.name.toLowerCase().includes(query.toLowerCase()) ||
        node.metadata.description?.toLowerCase().includes(query.toLowerCase()) ||
        node.metadata.technologies.some(tech =>
          tech.toLowerCase().includes(query.toLowerCase())
        )
      )

      if (matchingNodes.length > 0) {
        results.push({ graph, nodes: matchingNodes })
      }
    })

    return results
  }

  getNodeDependencies(projectId: string, nodeId: string): {
    dependencies: string[]
    dependents: string[]
  } {
    const graph = this.getProjectGraph(projectId)
    if (!graph) {
      return { dependencies: [], dependents: [] }
    }

    const dependencies = graph.edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target)

    const dependents = graph.edges
      .filter(edge => edge.target === nodeId)
      .map(edge => edge.source)

    return { dependencies, dependents }
  }

  getGraphMetrics(projectId: string): {
    nodeCount: number
    edgeCount: number
    complexity: number
    depth: number
    technologies: string[]
  } {
    const graph = this.getProjectGraph(projectId)
    if (!graph) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        complexity: 0,
        depth: 0,
        technologies: []
      }
    }

    const nodeCount = graph.nodes.length
    const edgeCount = graph.edges.length
    const complexity = this.calculateGraphComplexity(graph)
    const depth = this.calculateGraphDepth(graph)
    const technologies = graph.metadata.technologies

    return {
      nodeCount,
      edgeCount,
      complexity,
      depth,
      technologies
    }
  }

  private calculateGraphComplexity(graph: CodeGraph): number {
    // Calculate cyclomatic complexity based on nodes and edges
    // Complexity = E - N + 2P (where E = edges, N = nodes, P = connected components)
    const edges = graph.edges.length
    const nodes = graph.nodes.length
    const connectedComponents = this.countConnectedComponents(graph)

    return Math.max(1, edges - nodes + 2 * connectedComponents)
  }

  private calculateGraphDepth(graph: CodeGraph): number {
    // Calculate the maximum depth of the dependency graph
    const visited = new Set<string>()
    let maxDepth = 0

    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      maxDepth = Math.max(maxDepth, depth)

      const outgoingEdges = graph.edges.filter(edge => edge.source === nodeId)
      outgoingEdges.forEach(edge => {
        dfs(edge.target, depth + 1)
      })
    }

    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set(graph.edges.map(edge => edge.target))
    const rootNodes = graph.nodes.filter(node => !hasIncoming.has(node.id))

    if (rootNodes.length === 0 && graph.nodes.length > 0) {
      // If no clear root, start from first node
      dfs(graph.nodes[0].id, 0)
    } else {
      rootNodes.forEach(node => dfs(node.id, 0))
    }

    return maxDepth
  }

  private countConnectedComponents(graph: CodeGraph): number {
    const visited = new Set<string>()
    let components = 0

    const dfs = (nodeId: string): void => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      // Visit all connected nodes (both directions)
      graph.edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target)
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source)
        }
      })
    }

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id)
        components++
      }
    })

    return components
  }

  refreshLayout(projectId: string): void {
    const graph = this.getProjectGraph(projectId)
    if (!graph) return

    // Reapply layout algorithm
    GraphLayoutAlgorithms.applyLayout(
      graph.nodes,
      graph.edges,
      graph.layout.algorithm,
      graph.layout.parameters,
      graph.layout.bounds
    )

    // Optimize the layout
    GraphLayoutAlgorithms.optimizeLayout(
      graph.nodes,
      graph.edges,
      graph.layout.parameters
    )
  }

  exportGraphData(projectId: string): string {
    const graph = this.getProjectGraph(projectId)
    if (!graph) return ''

    return JSON.stringify(graph, null, 2)
  }

  getProjectTimeline(): { project: CodeGraph; startDate: Date; endDate: Date | null }[] {
    return this.projectGraphs
      .map(graph => ({
        project: graph,
        startDate: graph.metadata.startDate,
        endDate: graph.metadata.endDate || null
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }
}
