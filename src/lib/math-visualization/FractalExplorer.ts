import fragmentSource from '@/shaders/fractal.glsl'
import { ExhibitEvent, Placard, Readout, VisualizationControl } from '@/types/math-visualization'
import { BaseMathVisualization } from './BaseMathVisualization'
import { clamp, insetSlot, rgb } from './tokens'

type Family = 'mandelbrot' | 'julia' | 'burning-ship' | 'newton'

type FractalParameters = {
  family: string
  autoIterations: boolean
  iterations: number
  palette: string
  smooth: boolean
  juliaReal: number
  juliaImaginary: number
  relaxation: number
}

interface View {
  x: number
  y: number
  zoom: number
}

interface Place extends View {
  name: string
  family: Family
  julia?: [number, number]
}

// A triangle that covers the viewport, built from the vertex index alone
const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FAMILIES: { label: string; value: Family; formula: string }[] = [
  { label: 'Mandelbrot', value: 'mandelbrot', formula: 'z → z² + c' },
  { label: 'Julia', value: 'julia', formula: 'z → z² + c, with c held still' },
  { label: 'Burning Ship', value: 'burning-ship', formula: 'z → (|Re z| + i|Im z|)² + c' },
  { label: 'Newton', value: 'newton', formula: 'z → z − a(z³ − 1) / 3z²' }
]

// Bone runs black through the folio's bone to white. The other four are the
// gallery's original palettes.
const PALETTES: Record<string, string[]> = {
  Bone: ['#000000', '#d1d1d1', '#ffffff'],
  Classic: ['#000033', '#000055', '#0000ff', '#0055ff', '#00ffff', '#55ff00', '#ffff00', '#ff5500', '#ff0000', '#ffffff'],
  Fire: ['#000000', '#330000', '#660000', '#990000', '#cc0000', '#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00'],
  Ocean: ['#000033', '#003366', '#006699', '#0099cc', '#00ccff', '#33ddff', '#66eeff', '#99ffff', '#ccffff', '#ffffff'],
  Sunset: ['#1a0033', '#330066', '#660099', '#9900cc', '#cc00ff', '#ff00cc', '#ff3399', '#ff6666', '#ff9933', '#ffcc00']
}
const PALETTE_SLOTS = 11

const HOME: Record<Family, View> = {
  mandelbrot: { x: -0.7, y: 0, zoom: 1 },
  julia: { x: 0, y: 0, zoom: 1 },
  'burning-ship': { x: -0.45, y: 0.5, zoom: 0.85 },
  newton: { x: 0, y: 0, zoom: 1 }
}

const PLACES: Place[] = [
  { name: 'Seahorse Valley', family: 'mandelbrot', x: -0.7445, y: 0.118, zoom: 55 },
  { name: 'Elephant Valley', family: 'mandelbrot', x: 0.2815, y: 0.0115, zoom: 45 },
  { name: 'The period-3 bulb', family: 'mandelbrot', x: -0.1225, y: 0.7849, zoom: 6 },
  { name: 'A spiral', family: 'mandelbrot', x: -0.743644, y: 0.131826, zoom: 2500 },
  { name: 'A minibrot on the needle', family: 'mandelbrot', x: -1.7549, y: 0, zoom: 40 },
  { name: 'A Julia dendrite', family: 'julia', x: 0, y: 0, zoom: 1, julia: [0, 1] }
]

// Complex units across the shorter side of the stage at 1x
const SPAN = 3.2
const INSET = 240
const FLIGHT_SECONDS = 3
const ENTRANCE_SECONDS = 0.6
const HOLD_MS = 400
const DOUBLE_MS = 350
const MIN_ZOOM = 0.2
const MAX_ZOOM = 1e6
const BAILOUT = 256

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export class FractalExplorer extends BaseMathVisualization<FractalParameters> {
  readonly id = 'fractal'
  readonly name = 'Fractal'
  readonly description = 'A fractal drawn in the complex plane. Drag to pan, scroll or pinch to zoom.'
  renderer: 'webgl2' | '2d' = 'webgl2'

  private view: View = { ...HOME.mandelbrot }
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private uniforms = new Map<string, WebGLUniformLocation | null>()

  // The complex number under the pointer, shown as a Julia set in the inset
  private juliaAt: [number, number] | null = null
  private drag: { x: number; y: number; moved: boolean; inInset: boolean } | null = null
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private holding = false
  private lastClick = { x: 0, y: 0, time: 0 }
  private flight: { from: View; to: View; t: number } | null = null
  private placeIndex = 0
  private place: string | null = null
  private entrance = 0

  // The CPU fallback: half resolution, redrawn only when something changed
  private buffer: HTMLCanvasElement | null = null
  private cpuKey = ''

  constructor() {
    super({
      family: 'mandelbrot',
      autoIterations: true,
      iterations: 300,
      palette: 'Bone',
      smooth: true,
      juliaReal: -0.7,
      juliaImaginary: 0.27015,
      relaxation: 1
    })
  }

  protected async initializeVisualization(): Promise<void> {
    const host = this.host
    if (!this.canvas || !host) return
    if (this.renderer === 'webgl2' && !this.setupGL(this.canvas)) {
      // No WebGL2: the same picture on the CPU, on the 2D canvas
      this.renderer = '2d'
      this.canvas = host.canvases['2d']
      this.ctx = this.canvas.getContext('2d')
    }
    if (host.reducedMotion) this.entrance = 1
    this.cpuKey = ''
  }

  private setupGL(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) return false
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return false
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return false
    }
    this.gl = gl
    this.program = program
    this.uniforms.clear()
    return true
  }

  cleanup(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer)
    this.holdTimer = null
    this.drag = null
    this.flight = null
    if (this.gl && this.program) this.gl.deleteProgram(this.program)
    this.gl = null
    this.program = null
    this.buffer = null
    super.cleanup()
  }

  private get family(): Family {
    return this.parameters.family as Family
  }

  // The zoom on screen: the entrance eases it from 0.8x up to the real value
  private get shownZoom(): number {
    return this.view.zoom * (0.8 + 0.2 * easeOut(Math.min(1, this.entrance)))
  }

  // The stage pixel the view is centred on: the middle of the part the rail
  // leaves clear, and on a phone the part above the placard too
  private get anchor(): { x: number; y: number; side: number } {
    const { width, height } = this.size
    const { above } = this.clearRects()
    const phone = width < 768
    return {
      x: above.x + above.width / 2,
      y: phone ? above.y + above.height / 2 : height / 2,
      side: Math.max(1, Math.min(above.width, phone ? above.height : height))
    }
  }

  // Complex units per CSS pixel: one scale for both axes
  private get unit(): number {
    return SPAN / (this.anchor.side * this.shownZoom)
  }

  get iterations(): number {
    if (!this.parameters.autoIterations) return this.parameters.iterations
    return Math.round(clamp(200 + 90 * Math.log2(Math.max(1, this.view.zoom)), 50, 2000))
  }

  // Stage pixel to complex number. The imaginary axis points up.
  toComplex(x: number, y: number): [number, number] {
    const unit = this.unit
    const anchor = this.anchor
    return [this.view.x + (x - anchor.x) * unit, this.view.y - (y - anchor.y) * unit]
  }

  // The inset's rectangle in stage pixels, while there is one to draw
  getInset(): { x: number; y: number; width: number; height: number } | null {
    if (this.family !== 'mandelbrot' || !this.juliaAt || this.renderer !== 'webgl2') return null
    return insetSlot(this.size.width, this.size.height, INSET, INSET)
  }

  private overInset(x: number, y: number): boolean {
    const inset = this.getInset()
    return !!inset && x >= inset.x && x <= inset.x + inset.width && y >= inset.y && y <= inset.y + inset.height
  }

  update(deltaTime: number): void {
    if (this.entrance < 1 && deltaTime > 0) {
      this.entrance += deltaTime / ENTRANCE_SECONDS
      this.emitSoon()
    }
    if (this.flight && deltaTime > 0) {
      const flight = this.flight
      flight.t = Math.min(1, flight.t + deltaTime / FLIGHT_SECONDS)
      const e = easeInOut(flight.t)
      // Zoom moves evenly in its logarithm while the target drifts to the
      // middle of the screen, so the place being flown to stays in view
      const zoom = Math.exp(Math.log(flight.from.zoom) + (Math.log(flight.to.zoom) - Math.log(flight.from.zoom)) * e)
      const carry = (flight.from.zoom * (1 - e)) / zoom
      this.view = {
        x: flight.to.x + (flight.from.x - flight.to.x) * carry,
        y: flight.to.y + (flight.from.y - flight.to.y) * carry,
        zoom
      }
      if (flight.t >= 1) this.flight = null
      this.emitSoon()
    }
    if (this.renderer === 'webgl2') this.drawGL()
    else this.drawCPU()
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl!.getUniformLocation(this.program!, name))
    return this.uniforms.get(name) ?? null
  }

  private drawGL(): void {
    const { gl, program, canvas } = this
    if (!gl || !program || !canvas || gl.isContextLost()) return
    const { ratio } = this.size
    const colors = PALETTES[this.parameters.palette] ?? PALETTES.Bone
    const flat = new Float32Array(PALETTE_SLOTS * 3)
    colors.forEach((hex, index) => flat.set(rgb(hex).map(channel => channel / 255), index * 3))

    gl.useProgram(program)
    gl.uniform3fv(this.uniform('u_palette'), flat)
    gl.uniform1i(this.uniform('u_paletteSize'), colors.length)
    gl.uniform1i(this.uniform('u_iterations'), this.iterations)
    gl.uniform1i(this.uniform('u_smooth'), this.parameters.smooth ? 1 : 0)
    gl.uniform1f(this.uniform('u_relaxation'), this.parameters.relaxation)

    const pass = (x: number, y: number, width: number, height: number, family: number, view: View, scale: number, julia: number[]) => {
      gl.viewport(x, y, width, height)
      gl.scissor(x, y, width, height)
      gl.uniform2f(this.uniform('u_origin'), x, y)
      gl.uniform2f(this.uniform('u_resolution'), width, height)
      gl.uniform2f(this.uniform('u_center'), view.x, view.y)
      gl.uniform1f(this.uniform('u_scale'), scale)
      gl.uniform1i(this.uniform('u_family'), family)
      gl.uniform2f(this.uniform('u_julia'), julia[0], julia[1])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    gl.enable(gl.SCISSOR_TEST)
    const [x, y] = this.toComplex(this.size.width / 2, this.size.height / 2)
    pass(
      0,
      0,
      canvas.width,
      canvas.height,
      FAMILIES.findIndex(family => family.value === this.family),
      { x, y, zoom: 1 },
      this.unit / ratio,
      [this.parameters.juliaReal, this.parameters.juliaImaginary]
    )
    // The Julia inset: the same program through a second viewport
    const inset = this.getInset()
    if (inset && this.juliaAt) {
      const side = Math.round(inset.width * ratio)
      const left = Math.round(inset.x * ratio)
      const bottom = canvas.height - Math.round(inset.y * ratio) - side
      pass(left, bottom, side, side, 1, HOME.julia, SPAN / side, this.juliaAt)
    }
  }

  private drawCPU(): void {
    const { ctx, canvas } = this
    if (!ctx || !canvas) return
    const key = JSON.stringify([this.view, this.entrance < 1 ? this.entrance : 1, this.parameters, this.size])
    if (key === this.cpuKey) return
    this.cpuKey = key

    const width = Math.max(1, canvas.width >> 1)
    const height = Math.max(1, canvas.height >> 1)
    if (!this.buffer) this.buffer = document.createElement('canvas')
    this.buffer.width = width
    this.buffer.height = height
    const target = this.buffer.getContext('2d')
    if (!target) return
    const image = target.createImageData(width, height)
    const data = image.data

    const colors = (PALETTES[this.parameters.palette] ?? PALETTES.Bone).map(rgb)
    const shade = (t: number, offset: number, gain = 1) => {
      const x = clamp(t, 0, 1) * (colors.length - 1)
      const i = Math.floor(x)
      const j = Math.min(i + 1, colors.length - 1)
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = (colors[i][channel] + (colors[j][channel] - colors[i][channel]) * (x - i)) * gain
      }
    }

    const family = this.family
    const max = this.iterations
    const { smooth, juliaReal, juliaImaginary, relaxation } = this.parameters
    const unit = (this.unit * this.size.width) / width
    const [midRe, midIm] = this.toComplex(this.size.width / 2, this.size.height / 2)
    for (let py = 0; py < height; py++) {
      const im = midIm - (py + 0.5 - height / 2) * unit
      for (let px = 0; px < width; px++) {
        const re = midRe + (px + 0.5 - width / 2) * unit
        const offset = (py * width + px) * 4
        data[offset + 3] = 255
        if (family === 'newton') {
          let zr = re
          let zi = im
          for (let n = 0; n < max; n++) {
            const ar = zr * zr - zi * zi
            const ai = 2 * zr * zi
            const fr = ar * zr - ai * zi - 1
            const fi = ar * zi + ai * zr
            const m = 9 * (ar * ar + ai * ai)
            if (m < 1e-12) break
            zr -= (relaxation * 3 * (fr * ar + fi * ai)) / m
            zi -= (relaxation * 3 * (fi * ar - fr * ai)) / m
            let root = -1
            for (let k = 0; k < 3; k++) {
              const angle = (2 * Math.PI * k) / 3
              if (Math.hypot(zr - Math.cos(angle), zi - Math.sin(angle)) < 0.001) root = k
            }
            if (root >= 0) {
              shade((root + 1) / 3, offset, Math.exp(-0.09 * n))
              break
            }
          }
          continue
        }
        let zr = family === 'julia' ? re : 0
        let zi = family === 'julia' ? im : 0
        const cr = family === 'julia' ? juliaReal : re
        const ci = family === 'julia' ? juliaImaginary : family === 'burning-ship' ? -im : im
        let n = 0
        for (; n < max; n++) {
          if (zr * zr + zi * zi > BAILOUT) break
          if (family === 'burning-ship') {
            zr = Math.abs(zr)
            zi = Math.abs(zi)
          }
          const next = zr * zr - zi * zi + cr
          zi = 2 * zr * zi + ci
          zr = next
        }
        if (n >= max) continue
        const count = smooth ? n + 1 - Math.log2(0.5 * Math.log2(zr * zr + zi * zi)) : n
        const x = Math.max(count, 0)
        shade((Math.sqrt(x / max) * x) / (x + 4), offset)
      }
    }
    target.putImageData(image, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.buffer, 0, 0, canvas.width, canvas.height)
  }

  // The visitor has taken over: stop any flight and forget the named place
  private takeOver(): void {
    this.flight = null
    this.place = null
    this.entrance = 1
  }

  private zoomAbout(x: number, y: number, factor: number): void {
    this.takeOver()
    const [re, im] = this.toComplex(x, y)
    const zoom = clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const kept = this.view.zoom / zoom
    // The point under the pointer stays under the pointer
    this.view = { x: re + (this.view.x - re) * kept, y: im + (this.view.y - im) * kept, zoom }
    this.emitSoon()
  }

  handleInteraction(event: ExhibitEvent): boolean {
    switch (event.type) {
      case 'down': {
        this.takeOver()
        this.holding = false
        this.drag = { x: event.x, y: event.y, moved: false, inInset: this.overInset(event.x, event.y) }
        if (this.holdTimer) clearTimeout(this.holdTimer)
        // Press and hold on touch shows the inset for the point held
        if (event.pointerType !== 'mouse' && this.family === 'mandelbrot' && !this.drag.inInset) {
          this.holdTimer = setTimeout(() => {
            if (!this.drag || this.drag.moved) return
            this.holding = true
            this.juliaAt = this.toComplex(this.drag.x, this.drag.y)
            this.emit()
          }, HOLD_MS)
        }
        return true
      }
      case 'move': {
        const drag = this.drag
        if (!event.pressed || !drag) {
          // A hovering mouse: the inset follows it, and nothing else happens
          if (!event.pressed && this.family === 'mandelbrot' && !this.overInset(event.x, event.y)) {
            this.juliaAt = this.toComplex(event.x, event.y)
            this.emitSoon()
          }
          return false
        }
        const dx = event.x - drag.x
        const dy = event.y - drag.y
        if (this.holding) {
          this.juliaAt = this.toComplex(event.x, event.y)
        } else if (drag.moved || Math.hypot(dx, dy) > 4) {
          drag.moved = true
          // Two fingers zoom through `pinch`; one pans
          if (event.touches < 2) {
            this.view = { ...this.view, x: this.view.x - dx * this.unit, y: this.view.y + dy * this.unit }
          }
          drag.x = event.x
          drag.y = event.y
        }
        this.emitSoon()
        return true
      }
      case 'up': {
        const drag = this.drag
        this.drag = null
        if (this.holdTimer) clearTimeout(this.holdTimer)
        this.holdTimer = null
        if (!drag || drag.moved || this.holding) {
          this.holding = false
          return true
        }
        if (drag.inInset && this.juliaAt) {
          this.adoptJulia()
          return true
        }
        const now = performance.now()
        const double =
          now - this.lastClick.time < DOUBLE_MS && Math.hypot(event.x - this.lastClick.x, event.y - this.lastClick.y) < 24
        this.lastClick = double ? { x: 0, y: 0, time: 0 } : { x: event.x, y: event.y, time: now }
        if (double) this.zoomAbout(event.x, event.y, 2)
        // A single tap elsewhere puts a held inset away
        else if (event.pointerType !== 'mouse' && this.juliaAt) {
          this.juliaAt = null
          this.emit()
        }
        return true
      }
      case 'wheel':
        this.zoomAbout(event.x, event.y, Math.exp(-event.deltaY * (event.pinch ? 0.01 : 0.0015)))
        return true
      case 'pinch':
        this.zoomAbout(event.x, event.y, event.scale)
        return true
      case 'key': {
        const step = this.anchor.side * 0.1 * this.unit
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step]
        }
        const move = moves[event.key]
        if (move) {
          this.takeOver()
          this.view = { ...this.view, x: this.view.x + move[0], y: this.view.y + move[1] }
        } else if (event.key === '+' || event.key === '=') {
          this.zoomAbout(this.anchor.x, this.anchor.y, 1.5)
        } else if (event.key === '-' || event.key === '_') {
          this.zoomAbout(this.anchor.x, this.anchor.y, 1 / 1.5)
        } else {
          return false
        }
        this.emitSoon()
        return true
      }
    }
  }

  // Clicking the inset: the Julia set it shows becomes the exhibit
  private adoptJulia(): void {
    if (!this.juliaAt) return
    const [juliaReal, juliaImaginary] = this.juliaAt
    this.parameters = { ...this.parameters, family: 'julia', juliaReal, juliaImaginary }
    this.goHome()
    this.emit()
  }

  private goHome(): void {
    this.takeOver()
    this.view = { ...HOME[this.family] }
    this.juliaAt = null
  }

  private takeMeSomewhere(): void {
    const place = PLACES[this.placeIndex % PLACES.length]
    this.placeIndex += 1
    if (place.family !== this.family || place.julia) {
      this.parameters = {
        ...this.parameters,
        family: place.family,
        juliaReal: place.julia?.[0] ?? this.parameters.juliaReal,
        juliaImaginary: place.julia?.[1] ?? this.parameters.juliaImaginary
      }
      const home = HOME[place.family]
      this.view = { ...home, zoom: home.zoom * 0.6 }
    }
    this.takeOver()
    this.juliaAt = null
    this.place = place.name
    const to = { x: place.x, y: place.y, zoom: place.zoom }
    // Reduced motion cuts instead of flying
    if (this.host?.reducedMotion) this.view = to
    else {
      this.flight = { from: { ...this.view }, to, t: 0 }
      this.host?.setPaused(false)
    }
    this.emit()
  }

  protected onParameterChange(key: keyof FractalParameters): void {
    if (key === 'family') this.goHome()
  }

  getControls(): VisualizationControl[] {
    const { family } = this
    return [
      this.choice('family', 'Family', FAMILIES),
      this.toggle('autoIterations', 'Auto iterations'),
      this.slider('iterations', 'Iterations', 50, 2000, 10, {
        value: this.iterations,
        disabled: this.parameters.autoIterations
      }),
      this.choice(
        'palette',
        'Palette',
        Object.keys(PALETTES).map(name => ({ label: name, value: name }))
      ),
      this.toggle('smooth', 'Smooth colouring'),
      ...(family === 'julia'
        ? [
            this.slider('juliaReal', 'Julia constant, real', -2, 2, 0.001),
            this.slider('juliaImaginary', 'Julia constant, imaginary', -2, 2, 0.001)
          ]
        : []),
      ...(family === 'newton' ? [this.slider('relaxation', 'Newton relaxation', 0.5, 2, 0.05)] : []),
      this.button('somewhere', 'Take me somewhere', () => this.takeMeSomewhere(), { primary: true }),
      this.button('home', 'Reset view', () => {
        this.goHome()
        this.emit()
      })
    ]
  }

  getPlacard(): Placard {
    const formula = FAMILIES.find(entry => entry.value === this.family)?.formula ?? ''
    const text =
      this.family === 'newton'
        ? 'Each point is handed to Newton’s method and shaded by the root of z³ = 1 it lands on. Darker points took more steps to get there.'
        : this.family === 'mandelbrot' && this.renderer === 'webgl2'
          ? 'Black points never escape, and the rest are shaded by how fast they do. Point at the set, or press and hold, and the inset shows the Julia set for that point.'
          : 'Black points never escape, and the rest are shaded by how fast they do. Drag to pan, and scroll or pinch to zoom.'
    return { title: 'Fractal', formula, text, note: this.place ?? undefined }
  }

  private get centreText(): string {
    const digits = clamp(2 + Math.ceil(Math.log10(Math.max(1, this.view.zoom))), 4, 8)
    const { x, y } = this.view
    return `${x.toFixed(digits)} ${y < 0 ? '-' : '+'} ${Math.abs(y).toFixed(digits)}i`
  }

  private get zoomText(): string {
    const zoom = this.view.zoom
    return `${zoom < 1000 ? zoom.toPrecision(3) : zoom.toExponential(1).replace('e+', 'e')}x`
  }

  getLedger(): Readout[] {
    const gpu = this.renderer === 'webgl2'
    return [
      { key: 'Centre', value: this.centreText },
      { key: 'Zoom', value: this.zoomText },
      { key: 'Iterations', value: `${this.iterations}${this.parameters.autoIterations ? ' (auto)' : ''}` },
      gpu
        ? { key: 'Precision', value: 'float32 (GPU)', signal: 'compiled' }
        : { key: 'Precision', value: 'float64 (CPU), half resolution', signal: 'interpreted' }
    ]
  }

  describe(): string {
    const label = FAMILIES.find(entry => entry.value === this.family)?.label ?? ''
    const where = this.place ? `, at ${this.place}` : ''
    return `${label} set${where}, centred on ${this.centreText} at ${this.zoomText} zoom, ${this.iterations} iterations, ${this.parameters.palette} palette.`
  }

  getData(): Record<string, string> {
    const julia = this.juliaAt ?? [this.parameters.juliaReal, this.parameters.juliaImaginary]
    return {
      family: this.family,
      centre: `${this.view.x},${this.view.y}`,
      zoom: String(this.view.zoom),
      // The inset's constant while it is up, the family's own otherwise
      julia: `${julia[0]},${julia[1]}`,
      inset: this.getInset() ? 'shown' : 'hidden',
      // Where `centre` sits on the stage, and complex units per pixel
      anchor: `${this.anchor.x},${this.anchor.y}`,
      unit: String(this.unit),
      renderer: this.renderer
    }
  }
}
