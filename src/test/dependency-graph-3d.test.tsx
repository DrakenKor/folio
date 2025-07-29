import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DependencyGraph3D from '../components/DependencyGraph3D'
import { CodeArchitectureService } from '../lib/code-architecture/code-architecture-service'

// Mock Three.js and React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: () => ({
    camera: {
      position: { set: vi.fn() },
      lookAt: vi.fn()
    }
  })
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Text: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="text">{children}</div>
  ),
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="html">{children}</div>
  )
}))

vi.mock('three', () => ({
  Vector3: class Vector3 {
    x: number
    y: number
    z: number

    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }

    distanceTo() { return 1 }
    normalize() { return this }
    multiplyScalar() { return this }
    add() { return this }
    sub() { return this }
    subVectors() { return this }
    clone() { return new Vector3(this.x, this.y, this.z) }
    copy() { return this }
    lerp() { return this }
    clamp() { return this }
    setFromPoints() { return this }
  }
}))

describe('DependencyGraph3D Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<DependencyGraph3D />)
    expect(screen.getByText('Loading dependency graph...')).toBeInTheDocument()
  })

  it('should render project selector when data is loaded', async () => {
    // Mock the service to return immediately
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([
        {
          id: 'test-project',
          name: 'Test Project',
          nodes: [],
          edges: [],
          layout: {
            bounds: {
              min: { x: -10, y: -10, z: -10 },
              max: { x: 10, y: 10, z: 10 }
            }
          },
          metadata: {
            architecture: 'microservices'
          }
        }
      ]),
      getProjectGraph: vi.fn().mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        nodes: [],
        edges: [],
        layout: {
          bounds: {
            min: { x: -10, y: -10, z: -10 },
            max: { x: 10, y: 10, z: 10 }
          }
        },
        metadata: {
          architecture: 'microservices'
        }
      })
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument()
  })

  it('should render canvas when project data is available', async () => {
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([
        {
          id: 'test-project',
          name: 'Test Project',
          nodes: [
            {
              id: 'node1',
              name: 'Test Node',
              type: 'service',
              size: 100,
              dependencies: [],
              position3D: { x: 0, y: 0, z: 0 },
              metadata: {
                technologies: ['React', 'TypeScript'],
                description: 'Test node'
              }
            }
          ],
          edges: [],
          layout: {
            bounds: {
              min: { x: -10, y: -10, z: -10 },
              max: { x: 10, y: 10, z: 10 }
            }
          },
          metadata: {
            architecture: 'microservices'
          }
        }
      ]),
      getProjectGraph: vi.fn().mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        nodes: [
          {
            id: 'node1',
            name: 'Test Node',
            type: 'service',
            size: 100,
            dependencies: [],
            position3D: { x: 0, y: 0, z: 0 },
            metadata: {
              technologies: ['React', 'TypeScript'],
              description: 'Test node'
            }
          }
        ],
        edges: [],
        layout: {
          bounds: {
            min: { x: -10, y: -10, z: -10 },
            max: { x: 10, y: 10, z: 10 }
          }
        },
        metadata: {
          architecture: 'microservices'
        }
      })
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.getByTestId('canvas')).toBeInTheDocument()
  })

  it('should display graph statistics', async () => {
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([
        {
          id: 'test-project',
          name: 'Test Project',
          nodes: [{ id: 'node1' }, { id: 'node2' }],
          edges: [{ id: 'edge1' }],
          layout: {
            bounds: {
              min: { x: -10, y: -10, z: -10 },
              max: { x: 10, y: 10, z: 10 }
            }
          },
          metadata: {
            architecture: 'microservices'
          }
        }
      ]),
      getProjectGraph: vi.fn().mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        nodes: [{ id: 'node1' }, { id: 'node2' }],
        edges: [{ id: 'edge1' }],
        layout: {
          bounds: {
            min: { x: -10, y: -10, z: -10 },
            max: { x: 10, y: 10, z: 10 }
          }
        },
        metadata: {
          architecture: 'microservices'
        }
      })
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.getByText('Nodes:')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Edges:')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Architecture:')).toBeInTheDocument()
    expect(screen.getByText('microservices')).toBeInTheDocument()
  })

  it('should handle empty project data gracefully', async () => {
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([]),
      getProjectGraph: vi.fn().mockReturnValue(null)
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.getByText('No project data available')).toBeInTheDocument()
    expect(screen.getByText('Please check your project configuration')).toBeInTheDocument()
  })

  it('should call onNodeSelect callback when provided', async () => {
    const onNodeSelect = vi.fn()
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([
        {
          id: 'test-project',
          name: 'Test Project',
          nodes: [],
          edges: [],
          layout: {
            bounds: {
              min: { x: -10, y: -10, z: -10 },
              max: { x: 10, y: 10, z: 10 }
            }
          },
          metadata: {
            architecture: 'microservices'
          }
        }
      ]),
      getProjectGraph: vi.fn().mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        nodes: [],
        edges: [],
        layout: {
          bounds: {
            min: { x: -10, y: -10, z: -10 },
            max: { x: 10, y: 10, z: 10 }
          }
        },
        metadata: {
          architecture: 'microservices'
        }
      })
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D onNodeSelect={onNodeSelect} />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    // Component should be rendered without errors
    expect(screen.getByTestId('canvas')).toBeInTheDocument()
  })

  it('should handle project selection change', async () => {
    const mockService = {
      getProjectGraphs: vi.fn().mockReturnValue([
        {
          id: 'project1',
          name: 'Project 1',
          nodes: [],
          edges: [],
          layout: { bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } } },
          metadata: { architecture: 'microservices' }
        },
        {
          id: 'project2',
          name: 'Project 2',
          nodes: [],
          edges: [],
          layout: { bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } } },
          metadata: { architecture: 'monolith' }
        }
      ]),
      getProjectGraph: vi.fn()
        .mockReturnValueOnce({
          id: 'project1',
          name: 'Project 1',
          nodes: [],
          edges: [],
          layout: { bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } } },
          metadata: { architecture: 'microservices' }
        })
        .mockReturnValueOnce({
          id: 'project2',
          name: 'Project 2',
          nodes: [],
          edges: [],
          layout: { bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } } },
          metadata: { architecture: 'monolith' }
        })
    }

    vi.spyOn(CodeArchitectureService, 'getInstance').mockReturnValue(mockService as any)

    render(<DependencyGraph3D />)

    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(screen.getByDisplayValue('Project 1')).toBeInTheDocument()
  })
})
