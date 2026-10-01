import { ExhibitEvent, ExhibitSize, Placard, Readout, VisualizationControl } from '@/types/math-visualization'
import { BaseMathVisualization, roomier } from './BaseMathVisualization'
import { COLORS, insetSlot, mulberry32, rgb } from './tokens'

export type Activation = 'tanh' | 'relu' | 'sigmoid' | 'leaky_relu'

export interface Sample {
  x: number
  y: number
  label: 0 | 1
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

const activate = (kind: Activation, z: number) => {
  if (kind === 'tanh') return Math.tanh(z)
  if (kind === 'relu') return Math.max(0, z)
  if (kind === 'leaky_relu') return z > 0 ? z : 0.01 * z
  return sigmoid(z)
}

// The slope of the activation, from its input z and its output a
const slope = (kind: Activation, z: number, a: number) => {
  if (kind === 'tanh') return 1 - a * a
  if (kind === 'relu') return z > 0 ? 1 : 0
  if (kind === 'leaky_relu') return z > 0 ? 1 : 0.01
  return a * (1 - a)
}

/**
 * A small fully connected network with two inputs and one output. Hidden
 * layers use the chosen activation; the output is a sigmoid, read as the
 * probability of class 1.
 */
export class Network {
  // weights[l][j * fanIn + i] joins neuron i of layer l to neuron j of layer l + 1
  readonly weights: Float32Array[] = []
  readonly biases: Float32Array[] = []
  private inputs: Float32Array[] = []
  private outputs: Float32Array[]
  private deltas: Float32Array[] = []
  private weightSteps: Float32Array[] = []
  private biasSteps: Float32Array[] = []

  constructor(
    readonly layers: number[],
    readonly activation: Activation,
    random: () => number
  ) {
    this.outputs = [new Float32Array(layers[0])]
    for (let l = 1; l < layers.length; l++) {
      const size = layers[l]
      this.weights.push(Float32Array.from({ length: size * layers[l - 1] }, () => random() * 2 - 1))
      this.biases.push(Float32Array.from({ length: size }, () => random() * 2 - 1))
      this.weightSteps.push(new Float32Array(size * layers[l - 1]))
      this.biasSteps.push(new Float32Array(size))
      this.inputs.push(new Float32Array(size))
      this.outputs.push(new Float32Array(size))
      this.deltas.push(new Float32Array(size))
    }
  }

  get parameterCount(): number {
    return this.weights.reduce((sum, layer) => sum + layer.length, 0) + this.biases.reduce((sum, layer) => sum + layer.length, 0)
  }

  private kind(layer: number): Activation {
    return layer === this.layers.length - 1 ? 'sigmoid' : this.activation
  }

  forward(x: number, y: number): number {
    this.outputs[0][0] = x
    this.outputs[0][1] = y
    for (let l = 1; l < this.layers.length; l++) {
      const from = this.outputs[l - 1]
      const weights = this.weights[l - 1]
      const kind = this.kind(l)
      for (let j = 0; j < this.layers[l]; j++) {
        let sum = this.biases[l - 1][j]
        for (let i = 0; i < from.length; i++) sum += from[i] * weights[j * from.length + i]
        this.inputs[l - 1][j] = sum
        this.outputs[l][j] = activate(kind, sum)
      }
    }
    return this.outputs[this.layers.length - 1][0]
  }

  // One neuron's output from the last forward pass. Layer 0 is the input.
  neuron(layer: number, index: number): number {
    return this.outputs[layer][index]
  }

  /**
   * One step of backpropagation over a mini-batch. Each sample's error is
   * carried back through the layers as before; the nudges are summed over
   * the batch and applied together.
   */
  train(batch: Sample[], rate: number): void {
    const last = this.layers.length - 1
    this.weightSteps.forEach(layer => layer.fill(0))
    this.biasSteps.forEach(layer => layer.fill(0))

    for (const sample of batch) {
      const output = this.forward(sample.x, sample.y)
      this.deltas[last - 1][0] = (sample.label - output) * slope('sigmoid', this.inputs[last - 1][0], output)
      for (let l = last - 1; l >= 1; l--) {
        const next = this.deltas[l]
        const weights = this.weights[l]
        const width = this.layers[l]
        for (let i = 0; i < width; i++) {
          let error = 0
          for (let j = 0; j < next.length; j++) error += next[j] * weights[j * width + i]
          this.deltas[l - 1][i] = error * slope(this.kind(l), this.inputs[l - 1][i], this.outputs[l][i])
        }
      }
      for (let l = 1; l <= last; l++) {
        const from = this.outputs[l - 1]
        for (let j = 0; j < this.layers[l]; j++) {
          const delta = this.deltas[l - 1][j]
          this.biasSteps[l - 1][j] += delta
          for (let i = 0; i < from.length; i++) this.weightSteps[l - 1][j * from.length + i] += delta * from[i]
        }
      }
    }

    this.weights.forEach((layer, l) => {
      for (let k = 0; k < layer.length; k++) layer[k] += rate * this.weightSteps[l][k]
    })
    this.biases.forEach((layer, l) => {
      for (let k = 0; k < layer.length; k++) layer[k] += rate * this.biasSteps[l][k]
    })
  }
}

export const BATCH = 16

/** `steps` mini-batches of 16, drawn from `data` with `random`. */
export function trainSteps(network: Network, data: Sample[], rate: number, steps: number, random: () => number): void {
  if (!data.length) return
  const batch: Sample[] = new Array(BATCH)
  for (let step = 0; step < steps; step++) {
    for (let k = 0; k < BATCH; k++) batch[k] = data[Math.floor(random() * data.length)]
    network.train(batch, rate)
  }
}

/** Mean squared error and the share classified correctly, over all of `data`. */
export function score(network: Network, data: Sample[]): { loss: number; accuracy: number } {
  if (!data.length) return { loss: 0, accuracy: 0 }
  let loss = 0
  let correct = 0
  for (const sample of data) {
    const output = network.forward(sample.x, sample.y)
    loss += (output - sample.label) ** 2
    if (output > 0.5 === (sample.label === 1)) correct += 1
  }
  return { loss: loss / data.length, accuracy: correct / data.length }
}

/** The network read at the centre of every cell of a size-by-size grid over a rectangle of the plane. */
export function sampleGrid(
  network: Network,
  size: number,
  bounds: { left: number; top: number; right: number; bottom: number },
  read: (network: Network, output: number) => number = (_, output) => output
): Float32Array {
  const grid = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    const y = bounds.top + ((row + 0.5) / size) * (bounds.bottom - bounds.top)
    for (let column = 0; column < size; column++) {
      const x = bounds.left + ((column + 0.5) / size) * (bounds.right - bounds.left)
      grid[row * size + column] = read(network, network.forward(x, y))
    }
  }
  return grid
}

/** The preset datasets, inside the square from -1 to 1. */
export function makeData(kind: string, random: () => number): Sample[] {
  const jitter = (scale: number) => (random() * 2 - 1) * scale
  const data: Sample[] = []
  if (kind === 'xor') {
    for (let i = 0; i < 120; i++) {
      const x = (0.12 + random() * 0.78) * (random() < 0.5 ? -1 : 1)
      const y = (0.12 + random() * 0.78) * (random() < 0.5 ? -1 : 1)
      data.push({ x, y, label: x * y > 0 ? 1 : 0 })
    }
  } else if (kind === 'circle') {
    for (let i = 0; i < 160; i++) {
      const inside = i % 2 === 0
      const radius = inside ? 0.4 * Math.sqrt(random()) : 0.65 + 0.3 * random()
      const angle = random() * 2 * Math.PI
      data.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle), label: inside ? 1 : 0 })
    }
  } else if (kind === 'moons') {
    for (let i = 0; i < 70; i++) {
      const t = (Math.PI * i) / 69
      data.push({ x: (Math.cos(t) - 0.5) / 1.6 + jitter(0.05), y: -(Math.sin(t) - 0.25) / 1.6 + jitter(0.05), label: 1 })
      data.push({ x: (0.5 - Math.cos(t)) / 1.6 + jitter(0.05), y: -(0.25 - Math.sin(t)) / 1.6 + jitter(0.05), label: 0 })
    }
  } else if (kind === 'spirals') {
    for (let i = 0; i < 80; i++) {
      const radius = 0.1 + (0.85 * i) / 79
      const angle = (1.75 * 2 * Math.PI * i) / 79
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      data.push({ x: x + jitter(0.02), y: y + jitter(0.02), label: 1 })
      data.push({ x: -x + jitter(0.02), y: -y + jitter(0.02), label: 0 })
    }
  }
  return data
}

type NeuralParameters = {
  data: string
  layers: string
  activation: string
  // The slider runs on a logarithm: -3 to 0 is 0.001 to 1
  learningRate: number
  stepsPerFrame: number
}

const DATASETS = [
  { label: 'XOR', value: 'xor' },
  { label: 'Circle', value: 'circle' },
  { label: 'Two moons', value: 'moons' },
  { label: 'Two spirals', value: 'spirals' },
  { label: 'Your own', value: 'own' }
]
const LAYERS = ['2-4-1', '2-4-3-1', '2-8-8-1', '2-8-8-8-1'].map(value => ({ label: value, value }))
const ACTIVATIONS = [
  { label: 'tanh', value: 'tanh' },
  { label: 'ReLU', value: 'relu' },
  { label: 'sigmoid', value: 'sigmoid' },
  { label: 'leaky ReLU', value: 'leaky_relu' }
]

export const GRID = 96
export const DIAGRAM = { width: 260, height: 170 }
const HISTORY = 240
const TEAL = rgb(COLORS.teal)
const AMBER = rgb(COLORS.amber)

export class NeuralNetworkPlayground extends BaseMathVisualization<NeuralParameters> {
  readonly id = 'neural'
  readonly name = 'Neural net'
  readonly description =
    'The input plane, coloured by what a small neural network predicts at each point, with the data it is learning on top.'

  private seed: number
  private random: () => number
  private network!: Network
  private data: Sample[] = []
  private training = false
  private steps = 0
  private loss = 0
  private accuracy = 0
  private history: { step: number; loss: number }[] = []
  private diverged = false
  private probe: { layer: number; index: number } | null = null
  private press: { x: number; y: number; time: number; fingers: number; moved: boolean } | null = null

  // The boundary: a 96x96 picture stretched over the stage
  private picture: HTMLCanvasElement | null = null
  private stale = true
  private frame = 0
  private boundaryMs = 0

  constructor(seed = 1) {
    super({ data: 'circle', layers: '2-8-8-1', activation: 'tanh', learningRate: Math.log10(0.03), stepsPerFrame: 20 })
    this.seed = seed
    this.random = mulberry32(seed)
    this.data = makeData(this.parameters.data, this.random)
    this.build()
  }

  protected async initializeVisualization(): Promise<void> {
    this.stale = true
  }

  cleanup(): void {
    this.press = null
    this.picture = null
    super.cleanup()
  }

  private build(): void {
    this.network = new Network(this.parameters.layers.split('-').map(Number), this.parameters.activation as Activation, this.random)
    this.steps = 0
    this.history = []
    this.diverged = false
    this.probe = null
    this.measure()
  }

  private measure(): void {
    const { loss, accuracy } = score(this.network, this.data)
    this.loss = loss
    this.accuracy = accuracy
    this.stale = true
    if (!this.data.length) return
    this.history.push({ step: this.steps, loss })
    // Keep the chart light: past 240 points, drop every other one
    if (this.history.length > HISTORY) this.history = this.history.filter((_, i) => i % 2 === 0)
  }

  // Pixels per plane unit, and where the plane's origin sits on the stage
  private get plane(): { unit: number; x: number; y: number } {
    const { above, beside } = this.clearRects()
    // Keep the data clear of the network diagram, which sits at the bottom
    // beside the rail on a wide stage and under the tabs on a narrow one
    const diagram = this.getInsetSlot()
    if (diagram.y > this.size.height / 2) beside.height = diagram.y - 12 - beside.y
    else {
      above.height -= diagram.height + 12
      above.y += diagram.height + 12
    }
    const rect = roomier(above, beside)
    return { unit: Math.min(rect.width, rect.height) * 0.46, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }

  update(deltaTime: number): void {
    if (this.training && deltaTime > 0 && this.data.length) {
      trainSteps(this.network, this.data, Math.pow(10, this.parameters.learningRate), this.parameters.stepsPerFrame, this.random)
      this.steps += this.parameters.stepsPerFrame
      this.measure()
      if (!Number.isFinite(this.loss)) {
        this.training = false
        this.diverged = true
        this.emit()
      } else {
        this.emitSoon()
      }
    }

    const ctx = this.begin()
    if (!ctx) return
    const { width, height } = this.size
    const { unit, x: ox, y: oy } = this.plane
    this.frame += 1
    // The grid is re-read every third frame while training, and at once otherwise
    if (this.stale && (!this.training || this.frame % 3 === 0)) this.paint(width, height)
    if (this.picture) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(this.picture, 0, 0, width, height)
    }

    // Class 1 is a filled diamond, class 0 a hollow one
    ctx.lineWidth = 1.5
    for (const sample of this.data) {
      const x = ox + sample.x * unit
      const y = oy + sample.y * unit
      ctx.beginPath()
      ctx.moveTo(x, y - 5)
      ctx.lineTo(x + 5, y)
      ctx.lineTo(x, y + 5)
      ctx.lineTo(x - 5, y)
      ctx.closePath()
      ctx.fillStyle = sample.label ? COLORS.white : COLORS.black
      ctx.strokeStyle = sample.label ? COLORS.black : COLORS.white
      ctx.fill()
      ctx.stroke()
    }
  }

  private paint(width: number, height: number): void {
    const started = performance.now()
    const { unit, x, y } = this.plane
    const probe = this.probe
    const squash = probe && probe.layer < this.network.layers.length - 1 && this.parameters.activation !== 'sigmoid'
    // Every value lands between -1 (amber) and 1 (teal); zero is black
    const grid = sampleGrid(
      this.network,
      GRID,
      { left: -x / unit, top: -y / unit, right: (width - x) / unit, bottom: (height - y) / unit },
      (network, output) => {
        if (!probe) return 2 * output - 1
        const value = network.neuron(probe.layer, probe.index)
        return squash ? Math.tanh(value) : 2 * value - 1
      }
    )
    if (!this.picture) {
      this.picture = document.createElement('canvas')
      this.picture.width = GRID
      this.picture.height = GRID
    }
    const target = this.picture.getContext('2d')
    if (!target) return
    const image = target.createImageData(GRID, GRID)
    for (let i = 0; i < grid.length; i++) {
      const color = grid[i] > 0 ? TEAL : AMBER
      const strength = Math.min(1, Math.abs(grid[i])) * 0.5
      image.data[i * 4] = color[0] * strength
      image.data[i * 4 + 1] = color[1] * strength
      image.data[i * 4 + 2] = color[2] * strength
      image.data[i * 4 + 3] = 255
    }
    target.putImageData(image, 0, 0)
    this.stale = false
    this.boundaryMs = performance.now() - started
  }

  resize(size: ExhibitSize): void {
    super.resize(size)
    this.stale = true
  }

  handleInteraction(event: ExhibitEvent): boolean {
    if (event.type === 'down') {
      // A second finger makes it a two-finger tap, placed between the two
      if (this.press && event.touches >= 2) {
        this.press = { ...this.press, x: (this.press.x + event.x) / 2, y: (this.press.y + event.y) / 2, fingers: 2 }
      } else {
        this.press = { x: event.x, y: event.y, time: performance.now(), fingers: 1, moved: false }
      }
      return true
    }
    if (event.type === 'move') {
      const press = this.press
      if (event.pressed && press && press.fingers === 1 && Math.hypot(event.x - press.x, event.y - press.y) > 12) press.moved = true
      return false
    }
    if (event.type === 'up' && this.press && event.touches === 0) {
      const press = this.press
      this.press = null
      if (press.moved || performance.now() - press.time > 600) return true
      const { unit, x, y } = this.plane
      // A click is class 1. Shift-click, or a tap with two fingers, is class 0.
      this.addPoint((press.x - x) / unit, (press.y - y) / unit, event.shift || press.fingers > 1 ? 0 : 1)
      return true
    }
    return false
  }

  addPoint(x: number, y: number, label: 0 | 1): void {
    this.data.push({ x, y, label })
    this.measure()
    this.emit()
  }

  // Hovering a neuron in the diagram puts its output on the stage
  setProbe(probe: { layer: number; index: number } | null): void {
    this.probe = probe
    this.stale = true
    this.emit()
  }

  getDiagram(): { layers: number[]; weights: Float32Array[]; probe: { layer: number; index: number } | null } {
    return { layers: this.network.layers, weights: this.network.weights, probe: this.probe }
  }

  // Where the diagram sits over the stage
  getInsetSlot(width = DIAGRAM.width, height = DIAGRAM.height) {
    return insetSlot(this.size.width, this.size.height, width, height)
  }

  getHistory(): { step: number; loss: number }[] {
    return this.history
  }

  protected onParameterChange(key: keyof NeuralParameters): void {
    if (key === 'data') this.data = makeData(this.parameters.data, this.random)
    if (key === 'data' || key === 'layers' || key === 'activation') this.build()
  }

  getControls(): VisualizationControl[] {
    const running = this.training && !this.paused
    return [
      this.choice('data', 'Data', DATASETS),
      this.choice('layers', 'Layers', LAYERS),
      this.choice('activation', 'Activation', ACTIVATIONS),
      this.slider('learningRate', 'Learning rate', -3, 0, 0.01, { format: value => Math.pow(10, value).toPrecision(2) }),
      this.slider('stepsPerFrame', 'Steps per frame', 1, 200, 1),
      this.button(
        'train',
        running ? 'Pause' : 'Train',
        () => {
          this.training = !running
          if (this.training) this.host?.setPaused(false)
          this.emit()
        },
        { primary: true }
      ),
      this.button('reset', 'Reset weights', () => {
        this.random = mulberry32(++this.seed)
        this.build()
        this.emit()
      }),
      ...(this.parameters.data === 'own'
        ? [
            this.button('clear', 'Clear points', () => {
              this.data = []
              this.build()
              this.emit()
            })
          ]
        : [])
    ]
  }

  getPlacard(): Placard {
    const note = this.diverged
      ? 'The weights ran away. Lower the learning rate, then reset the weights.'
      : this.probe
        ? `Showing layer ${this.probe.layer}, neuron ${this.probe.index + 1} on its own.`
        : !this.data.length
          ? 'Click the stage to add a point. Shift-click, or tap with two fingers, adds the other class.'
          : undefined
    return {
      title: 'Neural net',
      formula: 'a′ = f(Wa + b), layer after layer',
      text: 'The stage is the input plane: teal where the network predicts the filled diamonds, amber where it predicts the hollow ones, black where it cannot say. Press Train and the boundary bends around the data.',
      note
    }
  }

  getLedger(): Readout[] {
    return [
      { key: 'Steps', value: this.steps.toLocaleString('en-GB') },
      { key: 'Loss', value: this.data.length ? this.loss.toFixed(4) : 'no data' },
      { key: 'Accuracy', value: this.data.length ? `${Math.round(this.accuracy * 100)}%` : 'no data' },
      { key: 'Parameters', value: String(this.network.parameterCount) }
    ]
  }

  describe(): string {
    const data = DATASETS.find(entry => entry.value === this.parameters.data)?.label ?? ''
    return `${data} data, ${this.data.length} points, and a ${this.parameters.layers} network after ${this.steps} training steps: loss ${this.loss.toFixed(4)}, ${Math.round(this.accuracy * 100)}% classified correctly.`
  }

  getData(): Record<string, string> {
    return {
      training: this.training ? 'on' : 'off',
      steps: String(this.steps),
      points: String(this.data.length),
      'boundary-ms': this.boundaryMs.toFixed(2)
    }
  }
}
