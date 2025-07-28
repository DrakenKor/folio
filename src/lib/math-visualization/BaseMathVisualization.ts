import { MathVisualization, InteractionEvent, VisualizationControl } from '@/types/math-visualization'

export abstract class BaseMathVisualization implements MathVisualization {
  public readonly id: string
  public readonly name: string
  public readonly description: string
  public readonly category: 'fourier' | 'fractal' | 'algorithm' | 'neural'

  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected animationId: number | null = null
  protected isInitialized = false
  protected parameters: Record<string, any> = {}

  constructor(
    id: string,
    name: string,
    description: string,
    category: 'fourier' | 'fractal' | 'algorithm' | 'neural'
  ) {
    this.id = id
    this.name = name
    this.description = description
    this.category = category
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    if (!this.ctx) {
      throw new Error('Failed to get 2D rendering context')
    }

    // Set up default parameters
    this.setupDefaultParameters()

    // Initialize visualization-specific setup
    await this.initializeVisualization()

    this.isInitialized = true
  }

  abstract update(deltaTime: number): void
  abstract handleInteraction(event: InteractionEvent): void
  abstract getControls(): VisualizationControl[]

  protected abstract setupDefaultParameters(): void
  protected abstract initializeVisualization(): Promise<void>

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  cleanup(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.isInitialized = false
  }

  setParameter(key: string, value: any): void {
    this.parameters[key] = value
    this.onParameterChange(key, value)
  }

  getParameter(key: string): any {
    return this.parameters[key]
  }

  reset(): void {
    this.setupDefaultParameters()
    this.onReset()
  }

  protected onParameterChange(key: string, value: any): void {
    // Override in subclasses for parameter-specific logic
  }

  protected onReset(): void {
    // Override in subclasses for reset-specific logic
  }

  protected clearCanvas(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  protected getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvas?.width || 0,
      height: this.canvas?.height || 0
    }
  }
}
