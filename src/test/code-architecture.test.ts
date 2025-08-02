import { describe, it, expect, beforeEach } from 'vitest'
import { CodeArchitectureService } from '../lib/code-architecture/code-architecture-service'
import { MockDataGenerator } from '../lib/code-architecture/mock-data-generator'
import { GraphLayoutAlgorithms } from '../lib/code-architecture/graph-layout-algorithms'
import { LayoutAlgorithm, NodeType, EdgeType } from '../types/code-architecture'

describe('Code Architecture Data Processing System', () => {
  let service: CodeArchitectureService

  beforeEach(() => {
    service = CodeArchitectureService.getInstance()
  })

  describe('MockDataGenerator', () => {
    it('should generate project graphs for all resume projects', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()

      expect(graphs).toHaveLength(5)
      expect(graphs.map(g => g.id)).toContain('stafflink-proptech')
      expect(graphs.map(g => g.id)).toContain('littles-lawyers-legaltech')
      expect(graphs.map(g => g.id)).toContain('autify-ai-testing')
      expect(graphs.map(g => g.id)).toContain('rezinaus-solutions')
      expect(graphs.map(g => g.id)).toContain('phoenix-crm')
    })

    it('should generate nodes with proper structure', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()
      const stafflinkGraph = graphs.find(g => g.id === 'stafflink-proptech')

      expect(stafflinkGraph).toBeDefined()
      expect(stafflinkGraph!.nodes.length).toBeGreaterThan(0)

      const node = stafflinkGraph!.nodes[0]
      expect(node).toHaveProperty('id')
      expect(node).toHaveProperty('name')
      expect(node).toHaveProperty('type')
      expect(node).toHaveProperty('size')
      expect(node).toHaveProperty('dependencies')
      expect(node).toHaveProperty('position3D')
      expect(node).toHaveProperty('metadata')
      expect(node.metadata).toHaveProperty('technologies')
    })

    it('should generate edges with proper relationships', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()
      const stafflinkGraph = graphs.find(g => g.id === 'stafflink-proptech')

      expect(stafflinkGraph!.edges.length).toBeGreaterThan(0)

      const edge = stafflinkGraph!.edges[0]
      expect(edge).toHaveProperty('id')
      expect(edge).toHaveProperty('source')
      expect(edge).toHaveProperty('target')
      expect(edge).toHaveProperty('type')
      expect(edge).toHaveProperty('weight')
      expect(edge.weight).toBeGreaterThan(0)
      expect(edge.weight).toBeLessThanOrEqual(1)
    })

    it('should generate technology migrations', () => {
      const migrations = MockDataGenerator.generateTechnologyMigrations()

      expect(migrations.length).toBeGreaterThan(0)
      expect(migrations.map(m => m.id)).toContain('js-to-ts-migration')
      expect(migrations.map(m => m.id)).toContain('blob-to-s3-migration')

      const jsMigration = migrations.find(m => m.id === 'js-to-ts-migration')
      expect(jsMigration!.fromTechnology).toBe('JavaScript')
      expect(jsMigration!.toTechnology).toBe('TypeScript')
      expect(jsMigration!.phases.length).toBeGreaterThan(0)
    })

    it('should generate file trees for projects', () => {
      const stafflinkTree = MockDataGenerator.generateFileTree('stafflink-proptech')

      expect(stafflinkTree.name).toBe('stafflink-proptech')
      expect(stafflinkTree.type).toBe('directory')
      expect(stafflinkTree.children).toBeDefined()
      expect(stafflinkTree.children!.length).toBeGreaterThan(0)

      // Check for src directory
      const srcDir = stafflinkTree.children!.find(child => child.name === 'src')
      expect(srcDir).toBeDefined()
      expect(srcDir!.type).toBe('directory')
    })
  })

  describe('GraphLayoutAlgorithms', () => {
    it('should apply force-directed layout', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()
      const graph = graphs[0]
      const originalPositions = graph.nodes.map(node => node.position3D.clone())

      GraphLayoutAlgorithms.applyLayout(
        graph.nodes,
        graph.edges,
        LayoutAlgorithm.FORCE_DIRECTED,
        graph.layout.parameters,
        graph.layout.bounds
      )

      // Positions should have changed (unless by extreme coincidence)
      const positionsChanged = graph.nodes.some((node, index) =>
        !node.position3D.equals(originalPositions[index])
      )
      expect(positionsChanged).toBe(true)
    })

    it('should apply hierarchical layout', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()
      const graph = graphs[0]

      GraphLayoutAlgorithms.applyLayout(
        graph.nodes,
        graph.edges,
        LayoutAlgorithm.HIERARCHICAL,
        graph.layout.parameters,
        graph.layout.bounds
      )

      // Check that nodes are positioned within bounds
      graph.nodes.forEach(node => {
        expect(node.position3D.x).toBeGreaterThanOrEqual(graph.layout.bounds.min.x)
        expect(node.position3D.x).toBeLessThanOrEqual(graph.layout.bounds.max.x)
        expect(node.position3D.y).toBeGreaterThanOrEqual(graph.layout.bounds.min.y)
        expect(node.position3D.y).toBeLessThanOrEqual(graph.layout.bounds.max.y)
      })
    })

    it('should apply circular layout', () => {
      const graphs = MockDataGenerator.generateProjectGraphs()
      const graph = graphs[0]

      GraphLayoutAlgorithms.applyLayout(
        graph.nodes,
        graph.edges,
        LayoutAlgorithm.CIRCULAR,
        graph.layout.parameters,
        graph.layout.bounds
      )

      // In circular layout, nodes should be roughly equidistant from center
      const center = {
        x: (graph.layout.bounds.max.x + graph.layout.bounds.min.x) / 2,
        z: (graph.layout.bounds.max.z + graph.layout.bounds.min.z) / 2
      }

      const distances = graph.nodes.map(node =>
        Math.sqrt(
          Math.pow(node.position3D.x - center.x, 2) +
          Math.pow(node.position3D.z - center.z, 2)
        )
      )

      // All distances should be similar (within reasonable tolerance)
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
      const maxDeviation = Math.max(...distances.map(d => Math.abs(d - avgDistance)))
      expect(maxDeviation).toBeLessThan(avgDistance * 0.5) // Allow 50% deviation
    })
  })

  describe('CodeArchitectureService', () => {
    it('should provide access to all project graphs', () => {
      const graphs = service.getProjectGraphs()
      expect(graphs.length).toBe(5)
    })

    it('should retrieve specific project graph by ID', () => {
      const stafflinkGraph = service.getProjectGraph('stafflink-proptech')
      expect(stafflinkGraph).toBeDefined()
      expect(stafflinkGraph!.id).toBe('stafflink-proptech')
      expect(stafflinkGraph!.metadata.company).toBe('StaffLink')
    })

    it('should provide technology migrations', () => {
      const migrations = service.getTechnologyMigrations()
      expect(migrations.length).toBeGreaterThan(0)
    })

    it('should retrieve file tree for project', () => {
      const fileTree = service.getFileTree('stafflink-proptech')
      expect(fileTree).toBeDefined()
      expect(fileTree!.name).toBe('stafflink-proptech')
    })

    it('should search projects by technology', () => {
      const reactProjects = service.getProjectsByTechnology('React')
      expect(reactProjects.length).toBeGreaterThan(0)

      reactProjects.forEach(project => {
        expect(
          project.metadata.technologies.some(tech =>
            tech.toLowerCase().includes('react')
          )
        ).toBe(true)
      })
    })

    it('should search projects by architecture', () => {
      const microservicesProjects = service.getProjectsByArchitecture('microservices')
      expect(microservicesProjects.length).toBeGreaterThan(0)

      microservicesProjects.forEach(project => {
        expect(project.metadata.architecture.toLowerCase()).toContain('microservices')
      })
    })

    it('should search projects by time range', () => {
      const recentProjects = service.getProjectsByTimeRange(
        new Date('2022-01-01'),
        new Date('2024-12-31')
      )
      expect(recentProjects.length).toBeGreaterThan(0)
    })

    it('should search nodes by query', () => {
      const results = service.searchNodes('React')
      expect(results.length).toBeGreaterThan(0)

      results.forEach(result => {
        expect(result.nodes.length).toBeGreaterThan(0)
        result.nodes.forEach(node => {
          const matchesQuery =
            node.name.toLowerCase().includes('react') ||
            node.metadata.description?.toLowerCase().includes('react') ||
            node.metadata.technologies.some((tech: string) =>
              tech.toLowerCase().includes('react')
            )
          expect(matchesQuery).toBe(true)
        })
      })
    })

    it('should calculate graph metrics', () => {
      const metrics = service.getGraphMetrics('stafflink-proptech')

      expect(metrics.nodeCount).toBeGreaterThan(0)
      expect(metrics.edgeCount).toBeGreaterThan(0)
      expect(metrics.complexity).toBeGreaterThan(0)
      expect(metrics.depth).toBeGreaterThanOrEqual(0)
      expect(metrics.technologies.length).toBeGreaterThan(0)
    })

    it('should get node dependencies', () => {
      const dependencies = service.getNodeDependencies('stafflink-proptech', 'property-list')

      expect(dependencies).toHaveProperty('dependencies')
      expect(dependencies).toHaveProperty('dependents')
      expect(Array.isArray(dependencies.dependencies)).toBe(true)
      expect(Array.isArray(dependencies.dependents)).toBe(true)
    })

    it('should provide project timeline', () => {
      const timeline = service.getProjectTimeline()

      expect(timeline.length).toBe(5)

      // Should be sorted by start date
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].startDate.getTime()).toBeGreaterThanOrEqual(
          timeline[i - 1].startDate.getTime()
        )
      }
    })
  })
})
