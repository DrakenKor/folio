import { ExhibitEvent, Placard, Readout, VisualizationControl } from '@/types/math-visualization'
import { BaseMathVisualization } from './BaseMathVisualization'
import { COLORS, mulberry32 } from './tokens'

export type SortId = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick' | 'heap'

// What an algorithm did, in order. A swap is two writes, a set is one.
export type SortStep =
  | { type: 'compare'; i: number; j: number }
  | { type: 'swap'; i: number; j: number }
  | { type: 'set'; i: number; value: number; previous: number }

export const ALGORITHMS: { id: SortId; name: string }[] = [
  { id: 'bubble', name: 'Bubble' },
  { id: 'selection', name: 'Selection' },
  { id: 'insertion', name: 'Insertion' },
  { id: 'merge', name: 'Merge' },
  { id: 'quick', name: 'Quick' },
  { id: 'heap', name: 'Heap' }
]

const INPUTS = [
  { label: 'Random', value: 'random' },
  { label: 'Nearly sorted', value: 'nearly' },
  { label: 'Reversed', value: 'reversed' },
  { label: 'Few unique', value: 'few' }
]

/** Every comparison and write `id` makes while sorting `input`, which is left untouched. */
export function sortSteps(id: SortId, input: number[]): SortStep[] {
  const a = [...input]
  const n = a.length
  const steps: SortStep[] = []
  // Is a[i] smaller than a[j]?
  const less = (i: number, j: number) => {
    steps.push({ type: 'compare', i, j })
    return a[i] < a[j]
  }
  const swap = (i: number, j: number) => {
    if (i === j) return
    steps.push({ type: 'swap', i, j })
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  const set = (i: number, value: number) => {
    steps.push({ type: 'set', i, value, previous: a[i] })
    a[i] = value
  }

  if (id === 'bubble') {
    for (let end = n - 1; end > 0; end--) {
      let swapped = false
      for (let j = 0; j < end; j++) {
        if (less(j + 1, j)) {
          swap(j, j + 1)
          swapped = true
        }
      }
      if (!swapped) break
    }
  } else if (id === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let min = i
      for (let j = i + 1; j < n; j++) if (less(j, min)) min = j
      swap(i, min)
    }
  } else if (id === 'insertion') {
    for (let i = 1; i < n; i++) {
      for (let j = i; j > 0 && less(j, j - 1); j--) swap(j, j - 1)
    }
  } else if (id === 'merge') {
    const merge = (low: number, high: number) => {
      if (low >= high) return
      const mid = (low + high) >> 1
      merge(low, mid)
      merge(mid + 1, high)
      const left = a.slice(low, mid + 1)
      const right = a.slice(mid + 1, high + 1)
      let i = 0
      let j = 0
      for (let k = low; k <= high; k++) {
        let takeLeft = j >= right.length
        if (!takeLeft && i < left.length) {
          steps.push({ type: 'compare', i: low + i, j: mid + 1 + j })
          takeLeft = left[i] <= right[j]
        }
        set(k, takeLeft ? left[i++] : right[j++])
      }
    }
    merge(0, n - 1)
  } else if (id === 'quick') {
    // The last element is the pivot, so sorted and reversed input hurt
    const quick = (low: number, high: number) => {
      if (low >= high) return
      let boundary = low
      for (let j = low; j < high; j++) {
        if (less(j, high)) swap(boundary++, j)
      }
      swap(boundary, high)
      quick(low, boundary - 1)
      quick(boundary + 1, high)
    }
    quick(0, n - 1)
  } else {
    const sift = (root: number, size: number) => {
      for (;;) {
        let largest = root
        const left = 2 * root + 1
        const right = left + 1
        if (left < size && less(largest, left)) largest = left
        if (right < size && less(largest, right)) largest = right
        if (largest === root) return
        swap(root, largest)
        root = largest
      }
    }
    for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n)
    for (let end = n - 1; end > 0; end--) {
      swap(0, end)
      sift(0, end)
    }
  }
  return steps
}

/** Apply one step to `values`, or take it back. */
export function applyStep(values: number[], step: SortStep, undo = false): void {
  if (step.type === 'swap') [values[step.i], values[step.j]] = [values[step.j], values[step.i]]
  else if (step.type === 'set') values[step.i] = undo ? step.previous : step.value
}

export function makeInput(shape: string, size: number, random: () => number): number[] {
  const values = Array.from({ length: size }, (_, i) => i + 1)
  const swap = (i: number, j: number) => {
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  if (shape === 'reversed') return values.reverse()
  if (shape === 'few') return values.map(() => Math.ceil((1 + Math.floor(random() * 5)) * (size / 5)))
  if (shape === 'nearly') {
    // Sorted, then one neighbouring pair in eight changes places
    for (let k = 0; k < size / 8; k++) {
      const i = Math.floor(random() * (size - 1))
      swap(i, i + 1)
    }
    return values
  }
  for (let i = size - 1; i > 0; i--) swap(i, Math.floor(random() * (i + 1)))
  return values
}

const fingerprint = (values: number[]) => {
  let hash = 2166136261
  for (const value of values) hash = Math.imul(hash ^ value, 16777619) >>> 0
  return hash.toString(16)
}

type SortingParameters = {
  mode: string
  algorithm: string
  input: string
  size: number
  // The slider runs on a logarithm: 0 to 3 is 1 to 1000 steps a second
  speed: number
  sound: boolean
} & Record<SortId, boolean>

interface Panel {
  id: SortId
  name: string
  steps: SortStep[]
  values: number[]
  inputFingerprint: string
  position: number
  comparisons: number
  writes: number
  // Finishing order, from 1. Zero while still sorting.
  place: number
}

export interface PanelView {
  id: SortId
  name: string
  x: number
  y: number
  width: number
  height: number
  comparisons: number
  writes: number
  state: 'Ready' | 'Running' | 'Paused' | 'Finished'
  place: number
  inputFingerprint: string
}

const GAP = 12
const stepsPerSecond = (speed: number) => Math.round(Math.pow(10, speed))

export class AlgorithmVisualizer extends BaseMathVisualization<SortingParameters> {
  readonly id = 'sorting'
  readonly name = 'Sorting'
  readonly description = 'Sorting algorithms working on the same array, drawn as bars.'

  private input: number[] = []
  private sorted: number[] = []
  private panels: Panel[] = []
  private status: 'ready' | 'running' | 'finished' = 'ready'
  private budget = 0
  private finished = 0
  private seed = 1
  private opened = false
  private audio: { context: AudioContext; oscillator: OscillatorNode; gain: GainNode } | null = null

  constructor() {
    super({
      mode: 'race',
      algorithm: 'quick',
      input: 'random',
      size: 64,
      speed: Math.log10(120),
      sound: false,
      bubble: true,
      selection: true,
      insertion: true,
      merge: true,
      quick: true,
      heap: true
    })
    this.shuffle()
  }

  protected async initializeVisualization(): Promise<void> {
    // The race is under way when the exhibit first opens. Under reduced
    // motion the stage is paused, so it waits at the first step.
    if (!this.opened) this.status = 'running'
    this.opened = true
  }

  cleanup(): void {
    this.setSound(false)
    super.cleanup()
  }

  private shuffle(): void {
    this.input = makeInput(this.parameters.input, this.parameters.size, mulberry32(this.seed++))
    this.sorted = [...this.input].sort((a, b) => a - b)
    this.deal()
  }

  // Every panel is handed its own copy of the same array
  private deal(): void {
    const single = this.parameters.mode === 'single'
    const chosen = ALGORITHMS.filter(entry => (single ? entry.id === this.parameters.algorithm : this.parameters[entry.id]))
    this.panels = chosen.map(entry => {
      const values = [...this.input]
      return {
        ...entry,
        values,
        inputFingerprint: fingerprint(values),
        steps: sortSteps(entry.id, values),
        position: 0,
        comparisons: 0,
        writes: 0,
        place: 0
      }
    })
    this.finished = 0
    this.budget = 0
    this.status = 'ready'
  }

  private forward(panel: Panel): SortStep | null {
    if (panel.position >= panel.steps.length) return null
    const step = panel.steps[panel.position++]
    applyStep(panel.values, step)
    if (step.type === 'compare') panel.comparisons += 1
    else panel.writes += step.type === 'swap' ? 2 : 1
    if (panel.position === panel.steps.length) panel.place = ++this.finished
    return step
  }

  private back(panel: Panel): void {
    if (panel.position === 0) return
    if (panel.place) {
      panel.place = 0
      this.finished -= 1
    }
    const step = panel.steps[--panel.position]
    applyStep(panel.values, step, true)
    if (step.type === 'compare') panel.comparisons -= 1
    else panel.writes -= step.type === 'swap' ? 2 : 1
  }

  private advance(count: number): void {
    // One voice: the first panel still sorting is the one heard
    const voice = this.panels.find(panel => !panel.place)
    let heard: number | null = null
    for (const panel of this.panels) {
      for (let i = 0; i < count && !panel.place; i++) {
        const step = this.forward(panel)
        if (panel === voice && step?.type === 'compare') heard = panel.values[step.i]
      }
    }
    if (heard !== null) this.tone(heard)
    if (this.finished === this.panels.length) {
      this.status = 'finished'
      this.emit()
    } else {
      this.emitSoon()
    }
  }

  // The panels' rectangles in stage pixels, shared by the bars and their labels
  private layout(): { x: number; y: number; width: number; height: number; label: number }[] {
    // Above the placard or beside it, whichever is larger
    const { above, beside } = this.clearRects()
    const safe = beside.width * beside.height > above.width * above.height ? beside : above
    const count = this.panels.length
    const columns = Math.min(count, safe.width < 600 ? 2 : 3)
    const rows = Math.ceil(count / columns)
    const width = (safe.width - GAP * (columns - 1)) / columns
    const height = (safe.height - GAP * (rows - 1)) / rows
    return this.panels.map((_, index) => ({
      x: safe.x + (index % columns) * (width + GAP),
      y: safe.y + Math.floor(index / columns) * (height + GAP),
      width,
      height,
      // Room at the top of each panel for its name and counts
      label: width < 240 ? 58 : 42
    }))
  }

  getPanels(): PanelView[] {
    const layout = this.layout()
    return this.panels.map((panel, index) => ({
      id: panel.id,
      name: panel.name,
      x: layout[index].x,
      y: layout[index].y,
      width: layout[index].width,
      height: layout[index].height,
      comparisons: panel.comparisons,
      writes: panel.writes,
      place: panel.place,
      inputFingerprint: panel.inputFingerprint,
      state: panel.place ? 'Finished' : this.status === 'ready' ? 'Ready' : this.paused ? 'Paused' : 'Running'
    }))
  }

  update(deltaTime: number): void {
    if (this.status === 'running' && deltaTime > 0) {
      this.budget += deltaTime * stepsPerSecond(this.parameters.speed)
      const count = Math.floor(this.budget)
      this.budget -= count
      if (count > 0) this.advance(count)
    }

    const ctx = this.begin()
    if (!ctx) return
    const layout = this.layout()
    const top = Math.max(...this.input, 1)
    this.panels.forEach((panel, index) => {
      const rect = layout[index]
      const pad = 10
      const x0 = rect.x + pad
      const base = rect.y + rect.height - pad - 5
      const ceiling = rect.y + rect.label
      const reach = base - ceiling - 10
      const slot = (rect.width - 2 * pad) / panel.values.length
      // Bars sit on whole device pixels, so thin ones stay crisp
      const snap = (value: number) => Math.round(value * this.size.ratio) / this.size.ratio
      const last = panel.place || !panel.position ? null : panel.steps[panel.position - 1]
      // Finished panels dim
      ctx.globalAlpha = panel.place ? 0.45 : 1

      panel.values.forEach((value, i) => {
        const x = snap(x0 + i * slot)
        const bar = Math.max(1 / this.size.ratio, snap(x0 + (i + 1) * slot) - x - (slot > 3 ? 1 : 0))
        const height = Math.max(1, (value / top) * reach)
        const touched = last && (last.i === i || (last.type !== 'set' && last.j === i))
        if (touched && last.type === 'compare') {
          // Being compared: amber, with a mark floating above the bar
          ctx.fillStyle = COLORS.amber
          ctx.fillRect(x, base - height - 7, Math.max(bar, 2), 3)
        } else if (touched) {
          // Just written: pink, with a line up to the top of the panel
          ctx.fillStyle = COLORS.pink
          ctx.fillRect(x + bar / 2 - 0.5, ceiling, 1, reach + 10 - height)
        } else if (value === this.sorted[i]) {
          // In its final place: white, with a tick under the bar
          ctx.fillStyle = COLORS.white
          ctx.fillRect(x, base + 2, bar, 3)
        } else {
          ctx.fillStyle = COLORS.bone
        }
        ctx.fillRect(x, base - height, bar, height)
      })
    })
    ctx.globalAlpha = 1
  }

  // Hovering and clicking the bars do nothing: the rail runs the race
  handleInteraction(event: ExhibitEvent): boolean {
    if (event.type !== 'key' || this.parameters.mode !== 'single') return false
    if (event.key === 'ArrowRight') this.step(1)
    else if (event.key === 'ArrowLeft') this.step(-1)
    else return false
    return true
  }

  private toggleRun(): void {
    if (this.status === 'running') {
      this.host?.setPaused(!this.paused)
      return
    }
    if (this.status === 'finished') this.deal()
    this.status = 'running'
    this.host?.setPaused(false)
    this.emit()
  }

  // One step forward or back, in single mode. The stage pauses to wait for the next.
  private step(direction: 1 | -1): void {
    const panel = this.panels[0]
    if (!panel) return
    this.host?.setPaused(true)
    if (direction === 1) {
      const step = this.forward(panel)
      if (step?.type === 'compare') this.tone(panel.values[step.i])
    } else {
      this.back(panel)
    }
    this.status = panel.place ? 'finished' : panel.position ? 'running' : 'ready'
    this.emit()
  }

  private setSound(on: boolean): void {
    if (on && !this.audio && typeof AudioContext !== 'undefined') {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      gain.gain.value = 0
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      this.audio = { context, oscillator, gain }
    }
    if (!on && this.audio) {
      this.audio.context.close()
      this.audio = null
      if (this.parameters.sound) this.parameters = { ...this.parameters, sound: false }
    }
  }

  // A short tone, pitched by the value compared: two octaves from 220 Hz
  private tone(value: number): void {
    if (!this.audio) return
    const { context, oscillator, gain } = this.audio
    const now = context.currentTime
    oscillator.frequency.setValueAtTime(220 * Math.pow(4, value / Math.max(...this.input, 1)), now)
    gain.gain.cancelScheduledValues(now)
    gain.gain.setTargetAtTime(0.08, now, 0.004)
    gain.gain.setTargetAtTime(0, now + 0.03, 0.015)
  }

  protected onParameterChange(key: keyof SortingParameters): void {
    if (key === 'sound') return this.setSound(this.parameters.sound)
    if (key === 'speed') return
    // At least one algorithm stays in the race
    if (ALGORITHMS.every(entry => !this.parameters[entry.id])) this.parameters = { ...this.parameters, [key]: true }
    if (key === 'input' || key === 'size') this.shuffle()
    else this.deal()
  }

  getControls(): VisualizationControl[] {
    const single = this.parameters.mode === 'single'
    const running = this.status === 'running'
    const panel = this.panels[0]
    return [
      this.choice(
        'mode',
        'Mode',
        [
          { label: 'Race', value: 'race' },
          { label: 'Single', value: 'single' }
        ],
        'segmented'
      ),
      ...(single
        ? [
            this.choice(
              'algorithm',
              'Algorithm',
              ALGORITHMS.map(entry => ({ label: entry.name, value: entry.id }))
            )
          ]
        : ALGORITHMS.map(entry => this.toggle(entry.id, entry.name, { group: 'Algorithms' }))),
      this.choice('input', 'Input', INPUTS),
      this.slider('size', 'Size', 16, 256, 1),
      this.slider('speed', 'Speed', 0, 3, 0.01, { format: value => `${stepsPerSecond(value)} steps a second` }),
      this.toggle('sound', 'Sound'),
      this.button(
        'shuffle',
        'Shuffle and start',
        () => {
          this.shuffle()
          this.status = 'running'
          this.host?.setPaused(false)
          this.emit()
        },
        { primary: true }
      ),
      this.button('run', running ? (this.paused ? 'Resume' : 'Pause') : 'Start', () => this.toggleRun()),
      this.button(
        'stop',
        'Stop',
        () => {
          // Back to the unsorted array
          this.deal()
          this.emit()
        },
        { disabled: this.status === 'ready' }
      ),
      ...(single
        ? [
            this.button('back', 'Step back', () => this.step(-1), { disabled: !panel?.position }),
            this.button('forward', 'Step forward', () => this.step(1), { disabled: !!panel?.place })
          ]
        : [])
    ]
  }

  getPlacard(): Placard {
    return {
      title: 'Sorting',
      formula: 'n²/2 comparisons against n log₂ n',
      text:
        this.parameters.mode === 'single'
          ? 'One algorithm, a step at a time. Amber bars are being compared, pink ones were just written, and white ones are where they will end up.'
          : 'The same array goes to every algorithm, and all of them take steps at the same rate. Amber bars are being compared, pink ones were just written, and white ones are where they will end up.'
    }
  }

  // The panel furthest along: the first to finish, or the one nearest its end
  private get leader(): Panel | undefined {
    const progress = (panel: Panel) => (panel.place ? 2 - panel.place / 10 : panel.position / Math.max(1, panel.steps.length))
    return [...this.panels].sort((a, b) => progress(b) - progress(a))[0]
  }

  getLedger(): Readout[] {
    const leader = this.leader
    const tag = this.panels.length > 1 && leader ? ` (${leader.name})` : ''
    return [
      { key: 'Array size', value: String(this.input.length) },
      { key: 'Comparisons', value: `${(leader?.comparisons ?? 0).toLocaleString('en-GB')}${tag}` },
      { key: 'Writes', value: `${(leader?.writes ?? 0).toLocaleString('en-GB')}${tag}` },
      { key: 'Finished', value: `${this.finished} of ${this.panels.length}` }
    ]
  }

  // For the table in the notes: finished panels in the order they finished
  getResults(): { name: string; comparisons: number; writes: number; place: number }[] {
    return this.panels
      .filter(panel => panel.place)
      .sort((a, b) => a.place - b.place)
      .map(({ name, comparisons, writes, place }) => ({ name, comparisons, writes, place }))
  }

  describe(): string {
    const names = this.panels.map(panel => panel.name).join(', ')
    const input = INPUTS.find(entry => entry.value === this.parameters.input)?.label.toLowerCase()
    return `${names} sort on ${this.input.length} values, ${input} to begin with. ${this.finished} of ${this.panels.length} finished.`
  }

  getData(): Record<string, string> {
    return {
      status: this.status,
      sound: this.parameters.sound ? 'on' : 'off',
      audio: this.audio ? 'open' : 'none',
      steps: this.panels.map(panel => panel.position).join(',')
    }
  }
}
