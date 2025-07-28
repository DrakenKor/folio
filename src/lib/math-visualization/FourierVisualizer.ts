import { BaseMathVisualization } from './BaseMathVisualization'
import { InteractionEvent, VisualizationControl } from '../../types/math-visualization'

interface ComplexNumber {
  real: number
  imaginary: number
}

interface FourierCoefficient {
  amplitude: number
  frequency: number
  phase: number
}

export class FourierVisualizer extends BaseMathVisualization {
  private drawingPath: { x: number; y: number }[] = []
  private fourierCoefficients: FourierCoefficient[] = []
  private animationTime = 0
  private isDrawing = false
  private showDrawing = true
  private showFourier = true
  private showCircles = true
  private numCoefficients = 50
  private animationSpeed = 1
  private reconstructedPath: { x: number; y: number }[] = []

  // Pan and zoom properties
  private panX = 0
  private panY = 0
  private zoom = 1
  private isPanning = false
  private lastPanPos = { x: 0, y: 0 }

  constructor() {
    super(
      'fourier-visualizer',
      'Fourier Transform Visualizer',
      'Draw any shape and watch it decompose into rotating circles and sine waves',
      'fourier'
    )
  }

  protected setupDefaultParameters(): void {
    this.parameters = {
      numCoefficients: 50,
      animationSpeed: 1,
      showDrawing: true,
      showFourier: true,
      showCircles: true,
      strokeWidth: 2,
      circleOpacity: 0.3,
      panX: 0,
      panY: 0,
      zoom: 1
    }

    // Initialize pan and zoom from parameters
    this.panX = this.parameters.panX
    this.panY = this.parameters.panY
    this.zoom = this.parameters.zoom
  }

  protected async initializeVisualization(): Promise<void> {
    // Set up default drawing path (a simple circle for demonstration)
    this.createDefaultPath()
    this.calculateFourierCoefficients()

    // Draw initial state
    this.clearCanvas()
    if (this.ctx) {
      this.ctx.fillStyle = '#3b82f6'
      this.ctx.fillRect(10, 10, 50, 50) // Test rectangle
    }
  }

  private createDefaultPath(): void {
    this.drawingPath = []
    const { width, height } = this.getCanvasSize()
    const centerX = width / 2 || 400
    const centerY = height / 2 || 300
    const radius = Math.min(width, height) / 6 || 80
    const points = 100

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI
      this.drawingPath.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      })
    }
  }

  private calculateFourierCoefficients(): void {
    if (this.drawingPath.length === 0) return

    this.fourierCoefficients = []
    const N = this.drawingPath.length
    const maxCoeff = Math.min(this.parameters.numCoefficients, Math.floor(N / 2))

    // Calculate Fourier coefficients using DFT
    for (let k = -maxCoeff; k <= maxCoeff; k++) {
      let real = 0
      let imaginary = 0

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        real += this.drawingPath[n].x * cos - this.drawingPath[n].y * sin
        imaginary += this.drawingPath[n].x * sin + this.drawingPath[n].y * cos
      }

      real /= N
      imaginary /= N

      const amplitude = Math.sqrt(real * real + imaginary * imaginary)
      const phase = Math.atan2(imaginary, real)

      if (amplitude > 0.1) { // Filter out very small coefficients
        this.fourierCoefficients.push({
          amplitude,
          frequency: k,
          phase
        })
      }
    }

    // Sort by amplitude (largest first) for better visual effect
    this.fourierCoefficients.sort((a, b) => b.amplitude - a.amplitude)
  }

  update(deltaTime: number): void {
    if (!this.ctx || !this.canvas) return

    this.animationTime += deltaTime * 0.001 * this.parameters.animationSpeed

    this.clearCanvas()
    const { width, height } = this.getCanvasSize()

    // Apply transformation matrix
    this.ctx.save()
    this.applyTransform()

    // Draw original path
    if (this.parameters.showDrawing && this.drawingPath.length > 0) {
      this.drawPath(this.drawingPath, '#666666', this.parameters.strokeWidth)
    }

    // Calculate and draw Fourier reconstruction
    if (this.parameters.showFourier) {
      this.drawFourierReconstruction(width, height)
    }

    this.ctx.restore()

    // Draw UI elements (zoom/pan info)
    this.drawUIInfo()
  }

  private drawPath(path: { x: number; y: number }[], color: string, lineWidth: number): void {
    if (!this.ctx || path.length < 2) return

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.beginPath()
    this.ctx.moveTo(path[0].x, path[0].y)

    for (let i = 1; i < path.length; i++) {
      this.ctx.lineTo(path[i].x, path[i].y)
    }

    this.ctx.stroke()
  }

  private drawFourierReconstruction(width: number, height: number): void {
    if (!this.ctx || this.fourierCoefficients.length === 0) return

    let x = width / 2
    let y = height / 2
    const circles: { x: number; y: number; radius: number }[] = []

    // Draw epicycles (rotating circles)
    if (this.parameters.showCircles) {
      this.ctx.strokeStyle = `rgba(100, 149, 237, ${this.parameters.circleOpacity})`
      this.ctx.lineWidth = 1

      for (const coeff of this.fourierCoefficients) {
        const prevX = x
        const prevY = y

        // Calculate position on circle
        const angle = coeff.frequency * this.animationTime + coeff.phase
        x += coeff.amplitude * Math.cos(angle)
        y += coeff.amplitude * Math.sin(angle)

        // Draw circle
        this.ctx.beginPath()
        this.ctx.arc(prevX, prevY, coeff.amplitude, 0, 2 * Math.PI)
        this.ctx.stroke()

        // Draw radius line
        this.ctx.beginPath()
        this.ctx.moveTo(prevX, prevY)
        this.ctx.lineTo(x, y)
        this.ctx.stroke()

        circles.push({ x: prevX, y: prevY, radius: coeff.amplitude })
      }
    }

    // Add current point to reconstructed path
    this.reconstructedPath.push({ x, y })

    // Limit path length for performance
    if (this.reconstructedPath.length > 1000) {
      this.reconstructedPath.shift()
    }

    // Draw reconstructed path
    if (this.reconstructedPath.length > 1) {
      this.drawPath(this.reconstructedPath, '#3b82f6', this.parameters.strokeWidth)
    }

    // Draw current point
    this.ctx.fillStyle = '#ef4444'
    this.ctx.beginPath()
    this.ctx.arc(x, y, 4, 0, 2 * Math.PI)
    this.ctx.fill()
  }

  handleInteraction(event: InteractionEvent): void {
    if (event.type === 'wheel' && event.position && event.wheelDelta) {
      // Handle zoom with mouse wheel
      const zoomFactor = event.wheelDelta > 0 ? 1.1 : 0.9
      this.zoomAt(event.position.x, event.position.y, zoomFactor)
      return
    }

    if (event.type === 'mouse' && event.position) {
      // Check for right-click or ctrl+click for panning
      const isPanMode = event.key === 'Control' || event.key === 'Meta'

      if (event.delta) {
        if (isPanMode || this.isPanning) {
          // Panning mode
          if (!this.isPanning) {
            this.isPanning = true
            this.lastPanPos = event.position
          }

          const deltaX = event.position.x - this.lastPanPos.x
          const deltaY = event.position.y - this.lastPanPos.y

          this.panX += deltaX / this.zoom
          this.panY += deltaY / this.zoom

          this.lastPanPos = event.position
          this.updateParameters()
        } else {
          // Drawing mode
          if (!this.isDrawing) {
            this.isDrawing = true
            this.drawingPath = []
            this.reconstructedPath = []
          }

          // Transform mouse coordinates to world coordinates
          const worldPos = this.screenToWorld(event.position.x, event.position.y)
          this.drawingPath.push(worldPos)

          // Recalculate Fourier coefficients in real-time (throttled)
          if (this.drawingPath.length % 5 === 0) {
            this.calculateFourierCoefficients()
            this.animationTime = 0 // Reset animation
          }
        }
      } else {
        // Mouse up - finish drawing or panning
        if (this.isDrawing) {
          this.isDrawing = false
          this.calculateFourierCoefficients()
          this.animationTime = 0
        }
        if (this.isPanning) {
          this.isPanning = false
        }
      }
    }
  }

  getControls(): VisualizationControl[] {
    return [
      {
        id: 'numCoefficients',
        label: 'Number of Circles',
        type: 'slider',
        value: this.parameters.numCoefficients,
        min: 5,
        max: 100,
        step: 5,
        onChange: (value) => {
          this.setParameter('numCoefficients', value)
          this.calculateFourierCoefficients()
        }
      },
      {
        id: 'animationSpeed',
        label: 'Animation Speed',
        type: 'slider',
        value: this.parameters.animationSpeed,
        min: 0.1,
        max: 3,
        step: 0.1,
        onChange: (value) => this.setParameter('animationSpeed', value)
      },
      {
        id: 'showDrawing',
        label: 'Show Original Drawing',
        type: 'toggle',
        value: this.parameters.showDrawing,
        onChange: (value) => this.setParameter('showDrawing', value)
      },
      {
        id: 'showFourier',
        label: 'Show Fourier Reconstruction',
        type: 'toggle',
        value: this.parameters.showFourier,
        onChange: (value) => this.setParameter('showFourier', value)
      },
      {
        id: 'showCircles',
        label: 'Show Epicycles',
        type: 'toggle',
        value: this.parameters.showCircles,
        onChange: (value) => this.setParameter('showCircles', value)
      },
      {
        id: 'strokeWidth',
        label: 'Line Width',
        type: 'slider',
        value: this.parameters.strokeWidth,
        min: 1,
        max: 5,
        step: 1,
        onChange: (value) => this.setParameter('strokeWidth', value)
      },
      {
        id: 'circleOpacity',
        label: 'Circle Opacity',
        type: 'slider',
        value: this.parameters.circleOpacity,
        min: 0.1,
        max: 1,
        step: 0.1,
        onChange: (value) => this.setParameter('circleOpacity', value)
      },
      {
        id: 'zoom',
        label: 'Zoom',
        type: 'slider',
        value: this.zoom,
        min: 0.1,
        max: 5,
        step: 0.1,
        onChange: (value) => {
          this.zoom = value
          this.updateParameters()
        }
      },
      {
        id: 'zoomIn',
        label: 'Zoom In',
        type: 'button',
        value: null,
        onChange: () => {
          const { width, height } = this.getCanvasSize()
          this.zoomAt(width / 2, height / 2, 1.2)
        }
      },
      {
        id: 'zoomOut',
        label: 'Zoom Out',
        type: 'button',
        value: null,
        onChange: () => {
          const { width, height } = this.getCanvasSize()
          this.zoomAt(width / 2, height / 2, 0.8)
        }
      },
      {
        id: 'resetView',
        label: 'Reset View',
        type: 'button',
        value: null,
        onChange: () => {
          this.panX = 0
          this.panY = 0
          this.zoom = 1
          this.updateParameters()
        }
      },
      {
        id: 'reset',
        label: 'Reset to Circle',
        type: 'button',
        value: null,
        onChange: () => {
          this.createDefaultPath()
          this.calculateFourierCoefficients()
          this.reconstructedPath = []
          this.animationTime = 0
        }
      }
    ]
  }

  protected onReset(): void {
    this.createDefaultPath()
    this.calculateFourierCoefficients()
    this.reconstructedPath = []
    this.animationTime = 0
    this.panX = 0
    this.panY = 0
    this.zoom = 1
    this.updateParameters()
  }

  private applyTransform(): void {
    if (!this.ctx) return

    const { width, height } = this.getCanvasSize()

    // Translate to center, apply zoom and pan
    this.ctx.translate(width / 2, height / 2)
    this.ctx.scale(this.zoom, this.zoom)
    this.ctx.translate(this.panX, this.panY)
    this.ctx.translate(-width / 2, -height / 2)
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const { width, height } = this.getCanvasSize()

    // Reverse the transformation
    const centerX = width / 2
    const centerY = height / 2

    const worldX = (screenX - centerX) / this.zoom - this.panX + centerX
    const worldY = (screenY - centerY) / this.zoom - this.panY + centerY

    return { x: worldX, y: worldY }
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const { width, height } = this.getCanvasSize()

    const centerX = width / 2
    const centerY = height / 2

    const screenX = (worldX - centerX + this.panX) * this.zoom + centerX
    const screenY = (worldY - centerY + this.panY) * this.zoom + centerY

    return { x: screenX, y: screenY }
  }

  private drawUIInfo(): void {
    if (!this.ctx) return

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    this.ctx.fillRect(10, 10, 220, 100)

    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '12px Arial'
    this.ctx.fillText(`Zoom: ${this.zoom.toFixed(2)}x`, 20, 30)
    this.ctx.fillText(`Pan: (${this.panX.toFixed(0)}, ${this.panY.toFixed(0)})`, 20, 50)

    this.ctx.font = '11px Arial'
    this.ctx.fillStyle = '#cccccc'
    this.ctx.fillText('• Mouse Wheel: Zoom', 20, 70)
    this.ctx.fillText('• Drag: Draw path', 20, 85)
    this.ctx.fillText('• Ctrl+Drag: Pan view', 20, 100)
  }

  private updateParameters(): void {
    this.parameters.panX = this.panX
    this.parameters.panY = this.panY
    this.parameters.zoom = this.zoom
  }

  private zoomAt(x: number, y: number, factor: number): void {
    const worldPos = this.screenToWorld(x, y)

    this.zoom *= factor
    this.zoom = Math.max(0.1, Math.min(10, this.zoom)) // Clamp zoom

    const newScreenPos = this.worldToScreen(worldPos.x, worldPos.y)
    this.panX += (x - newScreenPos.x) / this.zoom
    this.panY += (y - newScreenPos.y) / this.zoom

    this.updateParameters()
  }
}
