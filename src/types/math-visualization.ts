export type Renderer = '2d' | 'webgl2'

export type ControlValue = number | string | boolean

interface Located {
  // Stage coordinates in CSS pixels, origin top left
  x: number
  y: number
  // True while a button or a finger is down. A hovering mouse is a `move`
  // with `pressed` false, so no exhibit has to guess.
  pressed: boolean
}

export type ExhibitEvent =
  | (Located & {
      type: 'down' | 'move' | 'up'
      pointerType: string
      shift: boolean
      // How many pointers are down once this event has happened
      touches: number
    })
  // `pinch` is true for a trackpad pinch, which arrives as a wheel event
  | (Located & { type: 'wheel'; deltaY: number; pinch: boolean })
  // Two fingers: scale is the change in their distance since the last event
  | (Located & { type: 'pinch'; scale: number })
  | (Located & { type: 'key'; key: string })

export interface ExhibitSize {
  // CSS pixels. The backing store is these times `ratio`.
  width: number
  height: number
  ratio: number
  // Chrome floats over the stage. These insets are the part the bar, the tabs
  // and the rail leave clear.
  safe: { top: number; right: number; bottom: number; left: number }
  // The placard and ledger, at the bottom left inside that
  corner: { width: number; height: number }
}

// What the host lends an exhibit while it is on stage
export interface GalleryHost {
  // One canvas of each kind stays mounted; the host shows the one in use
  canvases: Record<Renderer, HTMLCanvasElement>
  reducedMotion: boolean
  // Pauses or resumes the whole stage, the same as pressing Space
  setPaused(paused: boolean): void
}

export interface VisualizationControl {
  // Stable for the life of the exhibit: it is the React key
  id: string
  label: string
  type: 'slider' | 'toggle' | 'select' | 'segmented' | 'button'
  value?: ControlValue
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  format?: (value: number) => string
  options?: { label: string; value: string }[]
  // Toggles that share a group are set side by side under its name
  group?: string
  // The exhibit's one primary button
  primary?: boolean
  disabled?: boolean
  onChange: (value: ControlValue) => void
}

export interface Placard {
  title: string
  formula: string
  // Two sentences
  text: string
  // One line about what is on stage right now, or what to do next
  note?: string
}

export interface Readout {
  key: string
  value: string
  signal?: 'compiled' | 'interpreted' | 'change'
}

export interface MathVisualization {
  id: string
  name: string
  description: string
  // May change during `initialize` when the preferred renderer is missing
  renderer: Renderer
  readonly ready: boolean

  initialize(canvas: HTMLCanvasElement, host: GalleryHost): Promise<void>
  // Advance by `deltaTime` seconds and draw. Zero repaints without advancing.
  update(deltaTime: number): void
  // True when the event was used, so the host can stop the page acting on it
  handleInteraction(event: ExhibitEvent): boolean
  resize(size: ExhibitSize): void
  cleanup(): void

  getControls(): VisualizationControl[]
  setParameter(key: string, value: ControlValue): void
  getParameter(key: string): ControlValue | undefined
  reset(): void

  // Labels and readouts follow internal state through these
  subscribe(listener: () => void): () => void
  getVersion(): number
  // The shell's pause state, mirrored so labels can say "Paused"
  setPaused(paused: boolean): void

  getPlacard(): Placard
  getLedger(): Readout[]
  // What is on stage now, in words
  describe(): string
  // Read-only state for the host element's data-* attributes
  getData(): Record<string, string>
}
