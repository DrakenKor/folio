import updateSource from '@/shaders/particles-update.glsl'
import updateFragment from '@/shaders/particles-update-fragment.glsl'
import drawSource from '@/shaders/particles-draw.glsl'
import drawFragment from '@/shaders/particles-draw-fragment.glsl'

export type Palette = 'bone' | 'velocity' | 'spectrum'
export type Rgb = [number, number, number]

export interface Forces {
  dt: number
  time: number
  spring: number
  flow: number
  drag: number
  // Stage units: the stage is 2 tall
  reach: number
  // +1 push, -1 pull, 0 off
  pointerSign: number
  fit: number
  // Where the shape sits, in stage units
  center: [number, number]
  aspect: number
  // x, y pairs in stage units, five at most
  pointers: number[]
  scatter: number
  scatterCenter: [number, number]
}

export interface Look {
  aspect: number
  // Backing pixels
  size: number
  palette: Palette
  bone: Rgb
  teal: Rgb
  amber: Rgb
  pink: Rgb
}

const PALETTES: Palette[] = ['bone', 'velocity', 'spectrum']
const STRIDE = 16 // bytes per point in a state buffer: position and velocity
const MAX_POINTERS = 5
// Brightness per point scales with 1 / sqrt(count); this sets the overall level
const ALPHA = 160

let live = 0
// How many GL buffers this module has created and not yet deleted
export const liveBuffers = () => live

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string, varyings?: string[]) {
  const make = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
    return shader
  }
  const result = gl.createProgram()!
  const shaders = [make(gl.VERTEX_SHADER, vertex), make(gl.FRAGMENT_SHADER, fragment)]
  shaders.forEach(shader => gl.attachShader(result, shader))
  if (varyings) gl.transformFeedbackVaryings(result, varyings, gl.INTERLEAVED_ATTRIBS)
  gl.linkProgram(result)
  shaders.forEach(shader => {
    gl.detachShader(result, shader)
    gl.deleteShader(shader)
  })
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) ?? 'program')
  return result
}

/**
 * Position and velocity for every point live in two GPU buffers. A step reads
 * one and writes the other through transform feedback, then they swap; the CPU
 * never sees the positions. Homes and seeds sit in a third, static buffer.
 */
export function createSimulation(gl: WebGL2RenderingContext) {
  const update = program(gl, updateSource, updateFragment, ['v_state'])
  const draw = program(gl, drawSource, drawFragment)
  const feedback = gl.createTransformFeedback()!
  const locations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>()
  const where = (shader: WebGLProgram, name: string) => {
    if (!locations.has(shader)) locations.set(shader, new Map())
    const cache = locations.get(shader)!
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(shader, name))
    return cache.get(name)!
  }

  let count = 0
  let read = 0
  let state: WebGLBuffer[] = []
  let homesBuffer: WebGLBuffer | null = null
  let seedBuffer: WebGLBuffer | null = null
  let vaos: WebGLVertexArrayObject[] = []

  const buffer = (data: Float32Array | number, usage: number) => {
    const made = gl.createBuffer()!
    live += 1
    gl.bindBuffer(gl.ARRAY_BUFFER, made)
    gl.bufferData(gl.ARRAY_BUFFER, data as Float32Array, usage)
    return made
  }
  const release = () => {
    vaos.forEach(vao => gl.deleteVertexArray(vao))
    ;[...state, homesBuffer, seedBuffer].forEach(made => {
      if (!made) return
      gl.deleteBuffer(made)
      live -= 1
    })
    vaos = []
    state = []
    homesBuffer = seedBuffer = null
  }

  // Deletes the old pair and makes a new one: points start spread across the stage
  const setCount = (next: number) => {
    release()
    count = next
    read = 0
    const initial = new Float32Array(count * 4)
    const seeds = new Float32Array(count)
    for (let n = 0; n < count; n++) {
      initial[n * 4] = (Math.random() * 2 - 1) * 1.5
      initial[n * 4 + 1] = Math.random() * 2 - 1
      seeds[n] = Math.random()
    }
    state = [buffer(initial, gl.DYNAMIC_COPY), buffer(count * STRIDE, gl.DYNAMIC_COPY)]
    homesBuffer = buffer(new Float32Array(count * 2), gl.STATIC_DRAW)
    seedBuffer = buffer(seeds, gl.STATIC_DRAW)
    vaos = state.map(current => {
      const vao = gl.createVertexArray()!
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, current)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, homesBuffer)
      gl.enableVertexAttribArray(1)
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer)
      gl.enableVertexAttribArray(2)
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)
      return vao
    })
    gl.bindVertexArray(null)
  }

  // Replaces the homes only: positions and velocities are left where they are
  const setHomes = (homes: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, homesBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, homes)
  }

  // Puts every point on its home, at rest
  const cut = (homes: Float32Array, fit: number, center: [number, number]) => {
    const next = new Float32Array(count * 4)
    for (let n = 0; n < count; n++) {
      next[n * 4] = homes[n * 2] * fit + center[0]
      next[n * 4 + 1] = homes[n * 2 + 1] * fit + center[1]
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, state[read])
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, next)
  }

  const step = (forces: Forces) => {
    gl.useProgram(update)
    const f = (name: string, value: number) => gl.uniform1f(where(update, name), value)
    f('u_dt', forces.dt)
    f('u_time', forces.time)
    f('u_spring', forces.spring)
    f('u_flow', forces.flow)
    f('u_drag', forces.drag)
    f('u_reach', forces.reach)
    f('u_pointerSign', forces.pointerSign)
    f('u_fit', forces.fit)
    f('u_scatter', forces.scatter)
    gl.uniform2f(where(update, 'u_center'), ...forces.center)
    gl.uniform2f(where(update, 'u_bounds'), forces.aspect + 0.05, 1.05)
    gl.uniform2f(where(update, 'u_scatterCenter'), ...forces.scatterCenter)
    gl.uniform1i(where(update, 'u_pointerCount'), forces.pointers.length / 2)
    const pointers = new Float32Array(MAX_POINTERS * 2)
    pointers.set(forces.pointers.slice(0, MAX_POINTERS * 2))
    gl.uniform2fv(where(update, 'u_pointers'), pointers)

    gl.bindVertexArray(vaos[read])
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback)
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state[1 - read])
    gl.enable(gl.RASTERIZER_DISCARD)
    gl.beginTransformFeedback(gl.POINTS)
    gl.drawArrays(gl.POINTS, 0, count)
    gl.endTransformFeedback()
    gl.disable(gl.RASTERIZER_DISCARD)
    // A buffer cannot stay bound for writing while it is read for drawing
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null)
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
    read = 1 - read
  }

  const render = (look: Look) => {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(draw)
    gl.uniform1f(where(draw, 'u_aspect'), look.aspect)
    gl.uniform1f(where(draw, 'u_size'), look.size)
    gl.uniform1f(where(draw, 'u_alpha'), Math.min(1, ALPHA / Math.sqrt(count)))
    gl.uniform1i(where(draw, 'u_palette'), PALETTES.indexOf(look.palette))
    gl.uniform3fv(where(draw, 'u_bone'), look.bone)
    gl.uniform3fv(where(draw, 'u_teal'), look.teal)
    gl.uniform3fv(where(draw, 'u_amber'), look.amber)
    gl.uniform3fv(where(draw, 'u_pink'), look.pink)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.bindVertexArray(vaos[read])
    gl.drawArrays(gl.POINTS, 0, count)
    gl.bindVertexArray(null)
  }

  const dispose = () => {
    release()
    gl.deleteTransformFeedback(feedback)
    gl.deleteProgram(update)
    gl.deleteProgram(draw)
  }

  return {
    setCount,
    setHomes,
    cut,
    step,
    render,
    dispose,
    // The state buffer holding the latest positions, then its twin, then homes
    buffers: () => [state[read], state[1 - read], homesBuffer],
    count: () => count
  }
}

export type Simulation = ReturnType<typeof createSimulation>
