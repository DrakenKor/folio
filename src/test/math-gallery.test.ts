import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GalleryManager } from '../lib/math-visualization/GalleryManager'
import { BaseMathVisualization } from '../lib/math-visualization/BaseMathVisualization'
import { InteractionEvent, VisualizationControl } from '../types/math-visualization'

class TestVisualization extends BaseMathVisualization {
  constructor() {
    super('test-viz', 'Test Visualization', 'A test visualization', 'fourier')
  }

  protected setupDefaultParameters(): void {
    this.parameters = {
      amplitude: 50,
      frequency: 0.01
    }
  }

  protected async initializeVisualization(): Promise<void> {
    // Mock initialization
  }

  update(deltaTime: number): void {
    // Mock update
  }

  handleInteraction(event: InteractionEvent): void {
    // Mock interaction handling
  }

  getControls(): VisualizationControl[] {
    return [
      {
        id: 'amplitude',
        label: 'Amplitude',
        type: 'slider',
        value: this.parameters.amplitude,
        min: 0,
        max: 100,
        onChange: (value) => this.setParameter('amplitude', value)
      }
    ]
  }
}

describe('GalleryManager', () => {
  let galleryManager: GalleryManager
  let testVisualization: TestVisualization

  beforeEach(() => {
    galleryManager = new GalleryManager()
    testVisualization = new TestVisualization()
  })

  afterEach(() => {
    galleryManager.cleanup()
  })

  it('should initialize with default sections', () => {
    const sections = galleryManager.getSections()
    expect(sections).toHaveLength(4)
    expect(sections.map(s => s.id)).toEqual(['fourier', 'fractal', 'algorithm', 'neural'])
  })

  it('should register and retrieve visualizations', () => {
    galleryManager.registerVisualization(testVisualization)

    const retrieved = galleryManager.getVisualization('test-viz')
    expect(retrieved).toBe(testVisualization)
  })

  it('should add visualizations to correct sections', () => {
    galleryManager.registerVisualization(testVisualization)

    const fourierSection = galleryManager.getSections().find(s => s.id === 'fourier')
    expect(fourierSection?.visualizations).toContain(testVisualization)
  })

  it('should unregister visualizations', () => {
    galleryManager.registerVisualization(testVisualization)
    galleryManager.unregisterVisualization('test-viz')

    const retrieved = galleryManager.getVisualization('test-viz')
    expect(retrieved).toBeUndefined()
  })

  it('should get visualizations by category', () => {
    galleryManager.registerVisualization(testVisualization)

    const fourierViz = galleryManager.getVisualizationsByCategory('fourier')
    expect(fourierViz).toContain(testVisualization)
  })
})

describe('BaseMathVisualization', () => {
  let visualization: TestVisualization

  beforeEach(() => {
    visualization = new TestVisualization()
  })

  afterEach(() => {
    visualization.cleanup()
  })

  it('should have correct properties', () => {
    expect(visualization.id).toBe('test-viz')
    expect(visualization.name).toBe('Test Visualization')
    expect(visualization.category).toBe('fourier')
  })

  it('should set and get parameters', () => {
    visualization.setParameter('amplitude', 75)
    expect(visualization.getParameter('amplitude')).toBe(75)
  })

  it('should provide controls', () => {
    const controls = visualization.getControls()
    expect(controls).toHaveLength(1)
    expect(controls[0].id).toBe('amplitude')
    expect(controls[0].type).toBe('slider')
  })

  it('should reset parameters', () => {
    visualization.setParameter('amplitude', 75)
    visualization.reset()
    expect(visualization.getParameter('amplitude')).toBe(50) // Default value
  })
})

describe('FourierVisualizer', () => {
  let fourierViz: any

  beforeEach(async () => {
    const { FourierVisualizer } = await import('../lib/math-visualization/FourierVisualizer')
    fourierViz = new FourierVisualizer()
  })

  afterEach(() => {
    fourierViz.cleanup()
  })

  it('should have correct properties', () => {
    expect(fourierViz.id).toBe('fourier-visualizer')
    expect(fourierViz.name).toBe('Fourier Transform Visualizer')
    expect(fourierViz.category).toBe('fourier')
  })

  it('should provide comprehensive controls', () => {
    const controls = fourierViz.getControls()
    expect(controls.length).toBeGreaterThan(5)

    const controlIds = controls.map((c: any) => c.id)
    expect(controlIds).toContain('numCoefficients')
    expect(controlIds).toContain('animationSpeed')
    expect(controlIds).toContain('showDrawing')
    expect(controlIds).toContain('showFourier')
    expect(controlIds).toContain('showCircles')
  })

  it('should handle parameter changes', () => {
    fourierViz.setParameter('numCoefficients', 25)
    expect(fourierViz.getParameter('numCoefficients')).toBe(25)

    fourierViz.setParameter('animationSpeed', 2)
    expect(fourierViz.getParameter('animationSpeed')).toBe(2)
  })

  it('should handle interaction events', () => {
    const interactionEvent = {
      type: 'mouse' as const,
      position: { x: 100, y: 100 },
      delta: { x: 5, y: 5 }
    }

    // Should not throw
    expect(() => fourierViz.handleInteraction(interactionEvent)).not.toThrow()
  })
})
describe('FractalExplorer', () => {
  let fractalViz: any

  beforeEach(async () => {
    const { FractalExplorer } = await import('../lib/math-visualization/FractalExplorer')
    fractalViz = new FractalExplorer()
  })

  afterEach(() => {
    fractalViz.cleanup()
  })

  it('should have correct properties', () => {
    expect(fractalViz.id).toBe('fractal-explorer')
    expect(fractalViz.name).toBe('Fractal Explorer')
    expect(fractalViz.category).toBe('fractal')
  })

  it('should provide fractal-specific controls', () => {
    const controls = fractalViz.getControls()
    expect(controls.length).toBeGreaterThan(5)

    const controlIds = controls.map((c: any) => c.id)
    expect(controlIds).toContain('fractalType')
    expect(controlIds).toContain('maxIterations')
    expect(controlIds).toContain('colorPalette')
    expect(controlIds).toContain('smoothColoring')
  })

  it('should switch between Mandelbrot and Julia sets', () => {
    fractalViz.setParameter('fractalType', 'julia')
    expect(fractalViz.getParameter('fractalType')).toBe('julia')

    const controls = fractalViz.getControls()
    const controlIds = controls.map((c: any) => c.id)
    expect(controlIds).toContain('juliaReal')
    expect(controlIds).toContain('juliaImaginary')
  })

  it('should handle mouse interactions for panning', () => {
    const interactionEvent = {
      type: 'mouse' as const,
      position: { x: 100, y: 100 },
      delta: { x: 10, y: 10 }
    }

    // Should not throw
    expect(() => fractalViz.handleInteraction(interactionEvent)).not.toThrow()
  })
})
describe('AlgorithmVisualizer', () => {
  let algorithmViz: any

  beforeEach(async () => {
    const { AlgorithmVisualizer } = await import('../lib/math-visualization/AlgorithmVisualizer')
    algorithmViz = new AlgorithmVisualizer()
  })

  afterEach(() => {
    algorithmViz.cleanup()
  })

  it('should have correct properties', () => {
    expect(algorithmViz.id).toBe('algorithm-visualizer')
    expect(algorithmViz.name).toBe('Algorithm Visualization')
    expect(algorithmViz.category).toBe('algorithm')
  })

  it('should provide algorithm-specific controls', () => {
    const controls = algorithmViz.getControls()
    expect(controls.length).toBeGreaterThan(5)

    const controlIds = controls.map((c: any) => c.id)
    expect(controlIds).toContain('algorithm')
    expect(controlIds).toContain('arraySize')
    expect(controlIds).toContain('animationSpeed')
    expect(controlIds).toContain('colorScheme')
    expect(controlIds).toContain('start')
    expect(controlIds).toContain('stop')
  })

  it('should support multiple sorting algorithms', () => {
    const algorithmControl = algorithmViz.getControls().find((c: any) => c.id === 'algorithm')
    expect(algorithmControl.options.length).toBeGreaterThan(3)

    const algorithmIds = algorithmControl.options.map((o: any) => o.value)
    expect(algorithmIds).toContain('bubble')
    expect(algorithmIds).toContain('selection')
    expect(algorithmIds).toContain('insertion')
    expect(algorithmIds).toContain('quick')
    expect(algorithmIds).toContain('merge')
  })

  it('should handle mouse interactions for play/pause', () => {
    const interactionEvent = {
      type: 'mouse' as const,
      position: { x: 100, y: 100 }
    }

    // Should not throw
    expect(() => algorithmViz.handleInteraction(interactionEvent)).not.toThrow()
  })
})
describe('NeuralNetworkPlayground', () => {
  let neuralViz: any

  beforeEach(async () => {
    const { NeuralNetworkPlayground } = await import('../lib/math-visualization/NeuralNetworkPlayground')
    neuralViz = new NeuralNetworkPlayground()
  })

  afterEach(() => {
    neuralViz.cleanup()
  })

  it('should have correct properties', () => {
    expect(neuralViz.id).toBe('neural-network-playground')
    expect(neuralViz.name).toBe('Neural Network Playground')
    expect(neuralViz.category).toBe('neural')
  })

  it('should provide neural network controls', () => {
    const controls = neuralViz.getControls()
    expect(controls.length).toBeGreaterThan(7)

    const controlIds = controls.map((c: any) => c.id)
    expect(controlIds).toContain('networkStructure')
    expect(controlIds).toContain('learningRate')
    expect(controlIds).toContain('activationFunction')
    expect(controlIds).toContain('datasetType')
    expect(controlIds).toContain('train')
    expect(controlIds).toContain('reset')
  })

  it('should support different activation functions', () => {
    const activationControl = neuralViz.getControls().find((c: any) => c.id === 'activationFunction')
    expect(activationControl.options.length).toBeGreaterThan(2)

    const activationTypes = activationControl.options.map((o: any) => o.value)
    expect(activationTypes).toContain('sigmoid')
    expect(activationTypes).toContain('tanh')
    expect(activationTypes).toContain('relu')
  })

  it('should support different datasets', () => {
    const datasetControl = neuralViz.getControls().find((c: any) => c.id === 'datasetType')
    expect(datasetControl.options.length).toBeGreaterThan(2)

    const datasetTypes = datasetControl.options.map((o: any) => o.value)
    expect(datasetTypes).toContain('xor')
    expect(datasetTypes).toContain('and')
    expect(datasetTypes).toContain('or')
  })

  it('should handle mouse interactions for neuron selection', () => {
    const interactionEvent = {
      type: 'mouse' as const,
      position: { x: 100, y: 100 }
    }

    // Should not throw
    expect(() => neuralViz.handleInteraction(interactionEvent)).not.toThrow()
  })
})
