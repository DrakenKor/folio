import {
  ControlValue,
  ExhibitEvent,
  ExhibitSize,
  GalleryHost,
  MathVisualization,
  Placard,
  Readout,
  Renderer,
  VisualizationControl
} from '@/types/math-visualization'

type Parameters = Record<string, ControlValue>
type ControlExtras = Partial<Omit<VisualizationControl, 'id' | 'label' | 'type' | 'onChange'>>

const READOUT_MS = 200
const GAP = 16

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Whichever rectangle gives a square the most room
export const roomier = (a: Rect, b: Rect): Rect => (Math.min(b.width, b.height) > Math.min(a.width, a.height) ? b : a)

export abstract class BaseMathVisualization<P extends Parameters = Parameters> implements MathVisualization {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  renderer: Renderer = '2d'

  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected host: GalleryHost | null = null
  protected size: ExhibitSize = {
    width: 0,
    height: 0,
    ratio: 1,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    corner: { width: 0, height: 0 }
  }
  protected parameters: P
  protected paused = false
  private initialized = false
  private run = 0
  private listeners = new Set<() => void>()
  private version = 0
  private readoutTimer: ReturnType<typeof setTimeout> | null = null

  // Parameters live from construction, so controls render before the exhibit
  // is on stage and keep their values when it comes back
  constructor(private readonly defaults: P) {
    this.parameters = { ...defaults }
  }

  get ready(): boolean {
    return this.initialized
  }

  async initialize(canvas: HTMLCanvasElement, host: GalleryHost): Promise<void> {
    this.canvas = canvas
    this.host = host
    this.ctx = this.renderer === '2d' ? canvas.getContext('2d') : null
    const run = ++this.run
    await this.initializeVisualization()
    // Taken off stage again before it finished arriving
    if (run !== this.run) return
    this.initialized = true
    this.emit()
  }

  abstract update(deltaTime: number): void
  abstract handleInteraction(event: ExhibitEvent): boolean
  abstract getControls(): VisualizationControl[]
  abstract getPlacard(): Placard
  abstract getLedger(): Readout[]
  abstract describe(): string
  abstract getData(): Record<string, string>

  protected abstract initializeVisualization(): Promise<void>

  resize(size: ExhibitSize): void {
    this.size = size
    // Insets and panels are placed from the size, so the page re-reads them
    this.emit()
  }

  cleanup(): void {
    if (this.readoutTimer) clearTimeout(this.readoutTimer)
    this.readoutTimer = null
    this.run += 1
    this.initialized = false
    this.canvas = null
    this.ctx = null
    this.host = null
  }

  setParameter(key: string, value: ControlValue): void {
    if (this.parameters[key] === value) return
    this.parameters = { ...this.parameters, [key]: value }
    this.onParameterChange(key as keyof P & string)
    this.emit()
  }

  getParameter(key: string): ControlValue | undefined {
    return this.parameters[key]
  }

  reset(): void {
    this.parameters = { ...this.defaults }
    this.onReset()
    this.emit()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    this.emit()
  }

  // State the page shows has changed: controls, placard and ledger re-read it
  protected emit(): void {
    if (this.readoutTimer) clearTimeout(this.readoutTimer)
    this.readoutTimer = null
    this.version += 1
    this.listeners.forEach(listener => listener())
  }

  // For readouts that move every frame: the page hears at most five a second
  protected emitSoon(): void {
    if (this.readoutTimer) return
    this.readoutTimer = setTimeout(() => this.emit(), READOUT_MS)
  }

  protected onParameterChange(_key: keyof P & string): void {}

  protected onReset(): void {}

  // Start a 2D frame in CSS pixels on a cleared canvas
  protected begin(): CanvasRenderingContext2D | null {
    if (!this.ctx || !this.size.width) return null
    const { ratio, width, height } = this.size
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.ctx.clearRect(0, 0, width, height)
    return this.ctx
  }

  // The two clear rectangles the chrome leaves, in CSS pixels: the one above
  // the placard, and the one beside it (which has no width on a phone)
  protected clearRects(): { above: Rect; beside: Rect } {
    const { width, height, safe, corner } = this.size
    const full = {
      x: safe.left,
      y: safe.top,
      width: Math.max(1, width - safe.left - safe.right),
      height: Math.max(1, height - safe.top - safe.bottom)
    }
    const taken = Math.min(full.width, corner.width + GAP)
    return {
      above: { ...full, height: Math.max(1, full.height - corner.height - GAP) },
      beside: { ...full, x: full.x + taken, width: full.width - taken }
    }
  }

  // Data-driven controls. Every change goes through setParameter.
  protected slider(id: keyof P & string, label: string, min: number, max: number, step: number, extras: ControlExtras = {}): VisualizationControl {
    return {
      id,
      label,
      type: 'slider',
      value: this.parameters[id],
      min,
      max,
      step,
      defaultValue: this.defaults[id] as number,
      onChange: value => this.setParameter(id, value),
      ...extras
    }
  }

  protected toggle(id: keyof P & string, label: string, extras: ControlExtras = {}): VisualizationControl {
    return { id, label, type: 'toggle', value: this.parameters[id], onChange: value => this.setParameter(id, value), ...extras }
  }

  protected choice(
    id: keyof P & string,
    label: string,
    options: { label: string; value: string }[],
    type: 'select' | 'segmented' = 'select'
  ): VisualizationControl {
    return { id, label, type, value: this.parameters[id], options, onChange: value => this.setParameter(id, value) }
  }

  protected button(id: string, label: string, run: () => void, extras: ControlExtras = {}): VisualizationControl {
    return { id, label, type: 'button', onChange: run, ...extras }
  }
}
