export interface InteractionEvent {
  type: 'mouse' | 'touch' | 'keyboard' | 'wheel'
  position?: { x: number; y: number }
  delta?: { x: number; y: number }
  key?: string
  pressure?: number
  wheelDelta?: number
}

export interface MathVisualization {
  id: string
  name: string
  description: string
  category: 'fourier' | 'fractal' | 'algorithm' | 'neural'

  initialize(canvas: HTMLCanvasElement): Promise<void>
  update(deltaTime: number): void
  handleInteraction(event: InteractionEvent): void
  resize(width: number, height: number): void
  cleanup(): void

  // Configuration and state
  getControls(): VisualizationControl[]
  setParameter(key: string, value: any): void
  getParameter(key: string): any
  reset(): void
}

export interface VisualizationControl {
  id: string
  label: string
  type: 'slider' | 'toggle' | 'select' | 'button' | 'color'
  value: any
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: any }[]
  onChange: (value: any) => void
}

export interface GallerySection {
  id: string
  title: string
  description: string
  visualizations: MathVisualization[]
  icon: string
}

export interface VisualizationState {
  isActive: boolean
  isLoading: boolean
  error?: string
  parameters: Record<string, any>
}
