import { BaseMathVisualization } from './BaseMathVisualization'
import { InteractionEvent, VisualizationControl } from '../../types/math-visualization'

interface ComplexNumber {
  real: number
  imaginary: number
}

interface ColorPalette {
  name: string
  colors: string[]
}

export class FractalExplorer extends BaseMathVisualization {
  private imageData: ImageData | null = null
  private isRendering = false
  private renderWorker: Worker | null = null
  private centerX = -0.5
  private centerY = 0
  private zoom = 1
  private isDragging = false
  private lastMousePos = { x: 0, y: 0 }

  private colorPalettes: ColorPalette[] = [
    {
      name: 'Classic',
      colors: ['#000033', '#000055', '#0000ff', '#0055ff', '#00ffff', '#55ff00', '#ffff00', '#ff5500', '#ff0000', '#ffffff']
    },
    {
      name: 'Fire',
      colors: ['#000000', '#330000', '#660000', '#990000', '#cc0000', '#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00']
    },
    {
      name: 'Ocean',
      colors: ['#000033', '#003366', '#006699', '#0099cc', '#00ccff', '#33ddff', '#66eeff', '#99ffff', '#ccffff', '#ffffff']
    },
    {
      name: 'Sunset',
      colors: ['#1a0033', '#330066', '#660099', '#9900cc', '#cc00ff', '#ff00cc', '#ff3399', '#ff6666', '#ff9933', '#ffcc00']
    }
  ]

  constructor() {
    super(
      'fractal-explorer',
      'Fractal Explorer',
      'Explore the infinite beauty of Mandelbrot and Julia sets with real-time zoom and pan',
      'fractal'
    )
  }

  protected setupDefaultParameters(): void {
    this.parameters = {
      fractalType: 'mandelbrot',
      maxIterations: 100,
      colorPalette: 'Classic',
      juliaReal: -0.7,
      juliaImaginary: 0.27015,
      smoothColoring: true,
      escapeRadius: 2
    }
  }

  protected async initializeVisualization(): Promise<void> {
    // Initialize with default view
    this.renderFractal()
  }

  private renderFractal(): void {
    if (!this.canvas || !this.ctx) return

    // Allow re-rendering even if currently rendering (for parameter changes)
    this.isRendering = true
    const { width, height } = this.getCanvasSize()

    // Create image data if needed
    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.imageData = this.ctx.createImageData(width, height)
    }

    // Render directly for immediate feedback
    this.renderDirect(width, height)
  }

  private renderWithWorker(width: number, height: number): void {
    // For now, render directly since setting up a worker is complex
    this.renderDirect(width, height)
  }

  private renderDirect(width: number, height: number): void {
    if (!this.imageData || !this.ctx) return

    const data = this.imageData.data
    const palette = this.getColorPalette(this.parameters.colorPalette)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4

        // Convert screen coordinates to complex plane
        const real = this.centerX + (x - width / 2) / (width / 4) / this.zoom
        const imaginary = this.centerY + (y - height / 2) / (height / 4) / this.zoom

        let iterations: number
        if (this.parameters.fractalType === 'mandelbrot') {
          iterations = this.mandelbrotIterations(real, imaginary)
        } else {
          iterations = this.juliaIterations(real, imaginary)
        }

        // Color based on iterations
        const color = this.getColor(iterations, palette)
        data[pixelIndex] = color.r
        data[pixelIndex + 1] = color.g
        data[pixelIndex + 2] = color.b
        data[pixelIndex + 3] = 255 // Alpha
      }
    }

    // Draw the image data to canvas immediately
    this.ctx.putImageData(this.imageData, 0, 0)

    this.isRendering = false
  }

  private mandelbrotIterations(cReal: number, cImaginary: number): number {
    let zReal = 0
    let zImaginary = 0
    let iterations = 0
    const maxIter = this.parameters.maxIterations
    const escapeRadius = this.parameters.escapeRadius

    while (iterations < maxIter && (zReal * zReal + zImaginary * zImaginary) < escapeRadius * escapeRadius) {
      const tempReal = zReal * zReal - zImaginary * zImaginary + cReal
      zImaginary = 2 * zReal * zImaginary + cImaginary
      zReal = tempReal
      iterations++
    }

    // Smooth coloring
    if (this.parameters.smoothColoring && iterations < maxIter) {
      const magnitude = Math.sqrt(zReal * zReal + zImaginary * zImaginary)
      iterations += 1 - Math.log2(Math.log2(magnitude))
    }

    return iterations
  }

  private juliaIterations(zReal: number, zImaginary: number): number {
    const cReal = this.parameters.juliaReal
    const cImaginary = this.parameters.juliaImaginary
    let iterations = 0
    const maxIter = this.parameters.maxIterations
    const escapeRadius = this.parameters.escapeRadius

    while (iterations < maxIter && (zReal * zReal + zImaginary * zImaginary) < escapeRadius * escapeRadius) {
      const tempReal = zReal * zReal - zImaginary * zImaginary + cReal
      zImaginary = 2 * zReal * zImaginary + cImaginary
      zReal = tempReal
      iterations++
    }

    // Smooth coloring
    if (this.parameters.smoothColoring && iterations < maxIter) {
      const magnitude = Math.sqrt(zReal * zReal + zImaginary * zImaginary)
      iterations += 1 - Math.log2(Math.log2(magnitude))
    }

    return iterations
  }

  private getColorPalette(paletteName: string): string[] {
    const palette = this.colorPalettes.find(p => p.name === paletteName)
    return palette ? palette.colors : this.colorPalettes[0].colors
  }

  private getColor(iterations: number, palette: string[]): { r: number; g: number; b: number } {
    const maxIter = this.parameters.maxIterations

    if (iterations >= maxIter) {
      return { r: 0, g: 0, b: 0 } // Black for points in the set
    }

    // Map iterations to color palette
    const normalizedIter = (iterations / maxIter) * (palette.length - 1)
    const colorIndex = Math.floor(normalizedIter)
    const fraction = normalizedIter - colorIndex

    const color1 = this.hexToRgb(palette[colorIndex])
    const color2 = this.hexToRgb(palette[Math.min(colorIndex + 1, palette.length - 1)])

    // Interpolate between colors
    return {
      r: Math.round(color1.r + (color2.r - color1.r) * fraction),
      g: Math.round(color1.g + (color2.g - color1.g) * fraction),
      b: Math.round(color1.b + (color2.b - color1.b) * fraction)
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  update(deltaTime: number): void {
    // Fractals are static - no continuous animation needed
    // The fractal is rendered immediately when parameters change
  }

  handleInteraction(event: InteractionEvent): void {
    if (event.type === 'mouse' && event.position) {
      if (event.delta) {
        // Dragging - pan the view
        if (!this.isDragging) {
          this.isDragging = true
          this.lastMousePos = event.position
        }

        const { width, height } = this.getCanvasSize()
        const deltaX = (event.position.x - this.lastMousePos.x) / (width / 4) / this.zoom
        const deltaY = (event.position.y - this.lastMousePos.y) / (height / 4) / this.zoom

        this.centerX -= deltaX
        this.centerY -= deltaY
        this.lastMousePos = event.position

        // Re-render with new center
        this.renderFractal()
      } else {
        // Mouse up - stop dragging
        this.isDragging = false
      }
    }
  }

  private zoomIn(centerX?: number, centerY?: number): void {
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom into specific point
      const { width, height } = this.getCanvasSize()
      const realX = this.centerX + (centerX - width / 2) / (width / 4) / this.zoom
      const realY = this.centerY + (centerY - height / 2) / (height / 4) / this.zoom

      this.centerX = realX
      this.centerY = realY
    }

    this.zoom *= 2
    this.renderFractal()
  }

  private zoomOut(): void {
    this.zoom /= 2
    this.renderFractal()
  }

  private resetView(): void {
    this.centerX = this.parameters.fractalType === 'mandelbrot' ? -0.5 : 0
    this.centerY = 0
    this.zoom = 1

    this.renderFractal()
  }

  getControls(): VisualizationControl[] {
    return [
      {
        id: 'fractalType',
        label: 'Fractal Type',
        type: 'select',
        value: this.parameters.fractalType,
        options: [
          { label: 'Mandelbrot Set', value: 'mandelbrot' },
          { label: 'Julia Set', value: 'julia' }
        ],
        onChange: (value) => {
          this.setParameter('fractalType', value)
        }
      },
      {
        id: 'maxIterations',
        label: 'Max Iterations',
        type: 'slider',
        value: this.parameters.maxIterations,
        min: 50,
        max: 500,
        step: 10,
        onChange: (value) => {
          this.setParameter('maxIterations', value)
        }
      },
      {
        id: 'colorPalette',
        label: 'Color Palette',
        type: 'select',
        value: this.parameters.colorPalette,
        options: this.colorPalettes.map(p => ({ label: p.name, value: p.name })),
        onChange: (value) => {
          this.setParameter('colorPalette', value)
        }
      },
      ...(this.parameters.fractalType === 'julia' ? [
        {
          id: 'juliaReal',
          label: 'Julia Real Part',
          type: 'slider' as const,
          value: this.parameters.juliaReal,
          min: -2,
          max: 2,
          step: 0.01,
          onChange: (value: number) => {
            this.setParameter('juliaReal', value)
          }
        },
        {
          id: 'juliaImaginary',
          label: 'Julia Imaginary Part',
          type: 'slider' as const,
          value: this.parameters.juliaImaginary,
          min: -2,
          max: 2,
          step: 0.01,
          onChange: (value: number) => {
            this.setParameter('juliaImaginary', value)
          }
        }
      ] : []),
      {
        id: 'smoothColoring',
        label: 'Smooth Coloring',
        type: 'toggle',
        value: this.parameters.smoothColoring,
        onChange: (value) => {
          this.setParameter('smoothColoring', value)
        }
      },
      {
        id: 'zoomIn',
        label: 'Zoom In (2x)',
        type: 'button',
        value: null,
        onChange: () => this.zoomIn()
      },
      {
        id: 'zoomOut',
        label: 'Zoom Out (0.5x)',
        type: 'button',
        value: null,
        onChange: () => this.zoomOut()
      },
      {
        id: 'reset',
        label: 'Reset View',
        type: 'button',
        value: null,
        onChange: () => this.resetView()
      }
    ]
  }

  resize(width: number, height: number): void {
    super.resize(width, height)
    // Re-render with new dimensions
    setTimeout(() => this.renderFractal(), 100)
  }

  protected onParameterChange(key: string, value: any): void {
    // Re-render when any parameter changes
    // Force immediate re-render for parameter changes
    this.isRendering = false // Reset rendering flag

    // Special handling for fractal type change
    if (key === 'fractalType') {
      this.resetView()
    } else {
      this.renderFractal()
    }
  }

  protected onReset(): void {
    this.resetView()
  }

  cleanup(): void {
    super.cleanup()
    if (this.renderWorker) {
      this.renderWorker.terminate()
      this.renderWorker = null
    }
  }
}
