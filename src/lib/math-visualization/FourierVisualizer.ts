import { ExhibitEvent, Placard, Readout, VisualizationControl } from '@/types/math-visualization'
import { BaseMathVisualization, Rect } from './BaseMathVisualization'
import { COLORS } from './tokens'

export interface Point {
  x: number
  y: number
}

// One circle: it turns `frequency` times per lap, with this radius and start angle
export interface Term {
  frequency: number
  amplitude: number
  phase: number
}

type FourierParameters = {
  shape: string
  circles: number
  speed: number
  showCircles: boolean
  showDrawing: boolean
}

export const SAMPLES = 512
// Frequencies -150 to 150 without zero: 300 circles at most
export const MAX_FREQUENCY = 150
const LAP_SECONDS = 12
const PORTRAIT_URL = '/profile.svg'

const SHAPES = [
  { label: 'Portrait outline', value: 'portrait' },
  { label: 'Treble clef', value: 'clef' },
  { label: 'Square', value: 'square' },
  { label: 'Draw your own', value: 'own' }
]

/** A closed path as `count` points evenly spaced along its length. */
export function resample(path: Point[], count = SAMPLES): Point[] {
  const closed = [...path, path[0]]
  const lengths = [0]
  for (let i = 1; i < closed.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(closed[i].x - closed[i - 1].x, closed[i].y - closed[i - 1].y))
  }
  const total = lengths[lengths.length - 1]
  if (total === 0) return Array.from({ length: count }, () => ({ ...path[0] }))
  const points: Point[] = []
  let segment = 1
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total
    while (segment < closed.length - 1 && lengths[segment] < target) segment++
    const span = lengths[segment] - lengths[segment - 1] || 1
    const t = (target - lengths[segment - 1]) / span
    points.push({
      x: closed[segment - 1].x + (closed[segment].x - closed[segment - 1].x) * t,
      y: closed[segment - 1].y + (closed[segment].y - closed[segment - 1].y) * t
    })
  }
  return points
}

/**
 * A plain discrete Fourier transform of the path read as complex numbers.
 * The zero-frequency term is the centroid and is returned apart, so it is
 * added once. The rest come back largest first.
 */
export function transform(points: Point[], maxFrequency = MAX_FREQUENCY): { centre: Point; terms: Term[] } {
  const count = points.length
  const coefficient = (k: number) => {
    let re = 0
    let im = 0
    for (let n = 0; n < count; n++) {
      const angle = (-2 * Math.PI * k * n) / count
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      re += points[n].x * cos - points[n].y * sin
      im += points[n].x * sin + points[n].y * cos
    }
    return { re: re / count, im: im / count }
  }
  const mean = coefficient(0)
  const terms: Term[] = []
  for (let k = -maxFrequency; k <= maxFrequency; k++) {
    if (k === 0) continue
    const { re, im } = coefficient(k)
    terms.push({ frequency: k, amplitude: Math.hypot(re, im), phase: Math.atan2(im, re) })
  }
  terms.sort((a, b) => b.amplitude - a.amplitude)
  return { centre: { x: mean.re, y: mean.im }, terms }
}

/** Where the last circle's rim is at `turn` (0 to 1 around the lap), using the first `count` circles. */
export function trace(centre: Point, terms: Term[], count: number, turn: number): Point {
  let x = centre.x
  let y = centre.y
  const limit = Math.min(count, terms.length)
  for (let i = 0; i < limit; i++) {
    const angle = 2 * Math.PI * terms[i].frequency * turn + terms[i].phase
    x += terms[i].amplitude * Math.cos(angle)
    y += terms[i].amplitude * Math.sin(angle)
  }
  return { x, y }
}

/** The whole lap, sampled at the same instants as the input path. */
export function reconstruct(centre: Point, terms: Term[], count: number, samples = SAMPLES): Point[] {
  return Array.from({ length: samples }, (_, i) => trace(centre, terms, count, i / samples))
}

// A cubic Bézier as `steps` straight pieces, without its first point
const flatten = (from: Point, a: Point, b: Point, to: Point, steps = 8): Point[] =>
  Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps
    const u = 1 - t
    return {
      x: u * u * u * from.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * to.x,
      y: u * u * u * from.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * to.y
    }
  })

/**
 * The longest closed subpath in an SVG whose paths use only M, C and Z with a
 * translate transform, which is how public/profile.svg is written.
 */
export function longestClosedPath(svg: string): Point[] {
  let best: Point[] = []
  let bestLength = 0
  for (const match of svg.matchAll(/<path d="([^"]+)"[^>]*?transform="translate\(([-\d.]+),([-\d.]+)\)"/g)) {
    const dx = Number(match[2])
    const dy = Number(match[3])
    for (const subpath of match[1].split('M').slice(1)) {
      if (!subpath.includes('Z')) continue
      const numbers = (subpath.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)
      const points: Point[] = [{ x: numbers[0] + dx, y: numbers[1] + dy }]
      for (let i = 2; i + 5 < numbers.length; i += 6) {
        const at = (offset: number) => ({ x: numbers[i + offset] + dx, y: numbers[i + offset + 1] + dy })
        points.push(...flatten(points[points.length - 1], at(0), at(2), at(4)))
      }
      let length = 0
      for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
      if (length > bestLength) {
        bestLength = length
        best = points
      }
    }
  }
  return best
}

// Centre a path on the origin and scale it so its longer side spans -1 to 1
const fit = (path: Point[]): Point[] => {
  const xs = path.map(point => point.x)
  const ys = path.map(point => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(...xs) - minX
  const height = Math.max(...ys) - minY
  const scale = 2 / Math.max(width, height, 1e-9)
  return path.map(point => ({ x: (point.x - minX - width / 2) * scale, y: (point.y - minY - height / 2) * scale }))
}

const SQUARE: Point[] = [
  { x: -0.8, y: -0.8 },
  { x: 0.8, y: -0.8 },
  { x: 0.8, y: 0.8 },
  { x: -0.8, y: 0.8 }
]

// A treble clef as the points a pen passes through, from the middle of the
// spiral to the hook at the foot. Smoothed below, then walked there and back
// so the path closes without a line across the drawing.
const CLEF: [number, number][] = [
  [0, 0.3],
  [-0.14, 0.2],
  [-0.12, 0.02],
  [0.05, -0.1],
  [0.27, -0.02],
  [0.36, 0.23],
  [0.2, 0.5],
  [-0.12, 0.56],
  [-0.38, 0.34],
  [-0.4, 0.02],
  [-0.22, -0.27],
  [0.02, -0.5],
  [0.17, -0.72],
  [0.18, -0.93],
  [0.09, -1.04],
  [-0.03, -0.93],
  [-0.06, -0.66],
  [0.01, -0.2],
  [0.09, 0.4],
  [0.14, 0.8],
  [0.08, 0.98],
  [-0.1, 1.03],
  [-0.23, 0.92],
  [-0.15, 0.8]
]

// Catmull-Rom through the points, eight pieces per span
const smooth = (points: [number, number][]): Point[] => {
  const at = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))]
  const out: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let step = 0; step < 8; step++) {
      const t = step / 8
      const blend = (axis: 0 | 1) =>
        0.5 *
        (2 * p1[axis] +
          (p2[axis] - p0[axis]) * t +
          (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t +
          (3 * p1[axis] - 3 * p2[axis] + p3[axis] - p0[axis]) * t * t * t)
      out.push({ x: blend(0), y: blend(1) })
    }
  }
  return out
}

const clef = (): Point[] => {
  const forward = smooth(CLEF)
  return [...forward, ...[...forward].reverse()]
}

export class FourierVisualizer extends BaseMathVisualization<FourierParameters> {
  readonly id = 'fourier'
  readonly name = 'Fourier'
  readonly description = 'A drawing retraced by a chain of turning circles. Press and draw on the stage to make your own.'

  // The path in its own units, about -1 to 1, and its transform
  private path: Point[] = []
  private centre: Point = { x: 0, y: 0 }
  private terms: Term[] = []
  private lap: Point[] = []
  private error = 0
  private turn = 0
  private stroke: Point[] | null = null
  private portrait: Point[] | null = null
  private portraitFailed = false
  private hover: Point | null = null
  private highlight: number | null = null
  private drawn = 0
  private extent = { x: 1, y: 1 }

  constructor() {
    super({ shape: 'portrait', circles: 60, speed: 1, showCircles: true, showDrawing: true })
  }

  protected async initializeVisualization(): Promise<void> {
    if (!this.path.length) this.loadShape()
  }

  // Pixels per path unit, and where the path's origin sits on the stage. A
  // preset is fitted to the clear space; a drawing stays where it was drawn.
  private get frame(): { unit: number; x: number; y: number } {
    const { above, beside } = this.clearRects()
    const fitted = (rect: Rect) => Math.min(rect.width / this.extent.x, rect.height / this.extent.y) * 0.42
    const rect = fitted(beside) > fitted(above) ? beside : above
    return { unit: fitted(rect), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }

  private loadShape(): void {
    const shape = this.parameters.shape
    if (shape === 'square') this.setPath(resample(SQUARE))
    else if (shape === 'clef') this.setPath(resample(fit(clef())))
    else if (shape === 'own') this.setPath([])
    else if (this.portrait) this.setPath(this.portrait)
    else this.fetchPortrait()
  }

  // Sampled once, the first time the exhibit asks for it
  private async fetchPortrait(): Promise<void> {
    try {
      const response = await fetch(PORTRAIT_URL)
      if (!response.ok) throw new Error(String(response.status))
      const outline = longestClosedPath(await response.text())
      if (outline.length < 3) throw new Error('no closed path')
      this.portrait = resample(fit(outline))
      this.portraitFailed = false
    } catch {
      this.portraitFailed = true
    }
    if (this.parameters.shape === 'portrait') {
      this.setPath(this.portrait ?? [])
      this.emit()
    }
  }

  private setPath(path: Point[]): void {
    this.path = path
    // Half the width and height of a preset, in path units
    const preset = this.parameters.shape !== 'own' && path.length > 0
    this.extent = {
      x: preset ? Math.max(...path.map(point => Math.abs(point.x)), 0.2) : 1,
      y: preset ? Math.max(...path.map(point => Math.abs(point.y)), 0.2) : 1
    }
    this.turn = 0
    this.highlight = null
    const result = path.length ? transform(path) : { centre: { x: 0, y: 0 }, terms: [] }
    this.centre = result.centre
    this.terms = result.terms
    this.rebuild()
  }

  // The lap and its error, recomputed whenever the circle count changes
  private rebuild(): void {
    const { path } = this
    this.lap = path.length ? reconstruct(this.centre, this.terms, this.parameters.circles, path.length) : []
    let sum = 0
    this.lap.forEach((point, i) => {
      sum += (point.x - path[i].x) ** 2 + (point.y - path[i].y) ** 2
    })
    this.error = path.length ? Math.sqrt(sum / path.length) : 0
  }

  update(deltaTime: number): void {
    const ctx = this.begin()
    if (!ctx) return
    this.turn = (this.turn + (deltaTime * this.parameters.speed) / LAP_SECONDS) % 1
    const { unit, x: ox, y: oy } = this.frame
    const place = (point: Point) => ({ x: ox + point.x * unit, y: oy + point.y * unit })
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // The stroke being drawn right now. A press that has not moved is not one yet.
    if (this.stroke && this.stroke.length > 2) {
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 2
      ctx.beginPath()
      this.stroke.forEach((point, i) => (i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)))
      ctx.stroke()
      this.setDrawn(0)
      return
    }
    if (!this.path.length) return this.setDrawn(0)

    if (this.parameters.showDrawing) {
      ctx.strokeStyle = COLORS.dim
      ctx.lineWidth = 1
      ctx.beginPath()
      this.path.forEach((point, i) => {
        const p = place(point)
        if (i) ctx.lineTo(p.x, p.y)
        else ctx.moveTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.stroke()
    }

    // The trace: the whole lap, brightest just behind the pen. It does not
    // depend on the circles being shown.
    const count = this.lap.length
    const pen = Math.floor(this.turn * count)
    const bands = 16
    ctx.strokeStyle = COLORS.white
    ctx.lineWidth = 2
    for (let band = 0; band < bands; band++) {
      ctx.globalAlpha = 1 - 0.8 * (band / (bands - 1))
      ctx.beginPath()
      const first = Math.floor((band * count) / bands)
      const last = Math.floor(((band + 1) * count) / bands)
      for (let age = first; age <= last; age++) {
        const p = place(this.lap[(((pen - age) % count) + count) % count])
        if (age === first) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // The circles, each centred on the rim of the one before
    const limit = Math.min(this.parameters.circles, this.terms.length)
    const show = this.parameters.showCircles
    let centre = place(this.centre)
    let nearest: number | null = null
    let nearestGap = 8
    ctx.lineWidth = 1
    for (let i = 0; i < limit; i++) {
      const term = this.terms[i]
      const radius = term.amplitude * unit
      const angle = 2 * Math.PI * term.frequency * this.turn + term.phase
      const rim = { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) }
      if (show) {
        const lit = term.frequency === this.highlight
        ctx.strokeStyle = lit ? COLORS.white : COLORS.bone
        ctx.globalAlpha = lit ? 1 : 0.28
        ctx.lineWidth = lit ? 2 : 1
        ctx.beginPath()
        ctx.arc(centre.x, centre.y, radius, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.globalAlpha = lit ? 1 : 0.6
        ctx.beginPath()
        ctx.moveTo(centre.x, centre.y)
        ctx.lineTo(rim.x, rim.y)
        ctx.stroke()
        if (this.hover) {
          const gap = Math.abs(Math.hypot(this.hover.x - centre.x, this.hover.y - centre.y) - radius)
          if (gap < nearestGap) {
            nearestGap = gap
            nearest = term.frequency
          }
        }
      }
      centre = rim
    }
    ctx.globalAlpha = 1
    this.setDrawn(show ? limit : 0)
    if (this.hover && nearest !== this.highlight) {
      this.highlight = nearest
      this.emit()
    }

    ctx.fillStyle = COLORS.white
    ctx.beginPath()
    ctx.arc(centre.x, centre.y, 3, 0, 2 * Math.PI)
    ctx.fill()
  }

  private setDrawn(count: number): void {
    if (count === this.drawn) return
    this.drawn = count
    this.emitSoon()
  }

  handleInteraction(event: ExhibitEvent): boolean {
    if (event.type === 'down') {
      this.stroke = [{ x: event.x, y: event.y }]
      this.hover = null
      return true
    }
    if (event.type === 'move') {
      if (event.pressed && this.stroke) {
        this.stroke.push({ x: event.x, y: event.y })
        return true
      }
      // Hovering lights the circle under the pointer and its bar. Nothing else.
      if (!event.pressed) this.hover = { x: event.x, y: event.y }
      return false
    }
    if (event.type === 'up' && this.stroke) {
      const stroke = this.stroke
      this.stroke = null
      let length = 0
      for (let i = 1; i < stroke.length; i++) length += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y)
      // A click is not a drawing
      if (stroke.length < 8 || length < 40) return true
      const { unit, x, y } = this.frame
      this.parameters = { ...this.parameters, shape: 'own' }
      this.setPath(resample(stroke.map(point => ({ x: (point.x - x) / unit, y: (point.y - y) / unit }))))
      this.emit()
      return true
    }
    return false
  }

  // One bar per frequency, lowest on the left. Heights are square roots of
  // the amplitudes, so the small circles can be seen at all.
  getSpectrum(): { frequency: number; height: number; used: boolean; lit: boolean }[] {
    const peak = this.terms[0]?.amplitude || 1
    const limit = this.parameters.circles
    return this.terms
      .map((term, rank) => ({
        frequency: term.frequency,
        height: Math.sqrt(term.amplitude / peak),
        used: rank < limit,
        lit: term.frequency === this.highlight
      }))
      .sort((a, b) => a.frequency - b.frequency)
  }

  // Hovering a bar lights its circle
  setHighlight(frequency: number | null): void {
    this.hover = null
    if (this.highlight === frequency) return
    this.highlight = frequency
    this.emit()
  }

  protected onParameterChange(key: keyof FourierParameters): void {
    if (key === 'shape') this.loadShape()
    if (key === 'circles') this.rebuild()
  }

  getControls(): VisualizationControl[] {
    return [
      this.choice('shape', 'Shape', SHAPES),
      this.slider('circles', 'Circles', 1, 2 * MAX_FREQUENCY, 1),
      this.slider('speed', 'Speed', 0.1, 3, 0.1, { format: value => `${value.toFixed(1)}x` }),
      this.toggle('showCircles', 'Show circles'),
      this.toggle('showDrawing', 'Show your drawing'),
      this.button('clear', 'Clear', () => {
        this.parameters = { ...this.parameters, shape: 'own' }
        this.setPath([])
        this.emit()
      })
    ]
  }

  getPlacard(): Placard {
    const note =
      this.parameters.shape === 'portrait' && this.portraitFailed
        ? 'The portrait outline did not load. Pick another shape, or draw your own.'
        : !this.path.length && this.parameters.shape === 'own'
          ? 'Press and draw a shape on the stage.'
          : undefined
    return {
      title: 'Fourier',
      formula: 'z(t) = Σ cₖ e^(ikt)',
      text: 'Any closed drawing is a sum of circles turning at whole-number speeds. Draw on the stage, then drag Circles up from 1 and watch the trace find the shape.',
      note
    }
  }

  getLedger(): Readout[] {
    return [
      { key: 'Points', value: String(this.path.length) },
      { key: 'Circles', value: String(Math.min(this.parameters.circles, this.terms.length)) },
      { key: 'Error', value: this.path.length ? `${(this.error * this.frame.unit).toFixed(1)} px RMS` : 'none' }
    ]
  }

  describe(): string {
    if (!this.path.length) return 'An empty stage, waiting for a drawing.'
    const shape = SHAPES.find(entry => entry.value === this.parameters.shape)?.label ?? ''
    return `${shape}, retraced by ${this.parameters.circles} circles, ${(this.error * this.frame.unit).toFixed(1)} pixels from the drawing on average.`
  }

  getData(): Record<string, string> {
    return {
      shape: this.parameters.shape,
      points: String(this.path.length),
      // How many circles the last frame drew
      circles: String(this.drawn),
      highlight: this.highlight === null ? 'none' : String(this.highlight)
    }
  }
}
