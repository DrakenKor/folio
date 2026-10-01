import { ShaderManager } from '@/lib/shader-management/ShaderManager'
import { VERTEX_SHADER } from '@/lib/shader-source'
import advect from '@/shaders/fluid-advect.glsl'
import divergence from '@/shaders/fluid-divergence.glsl'
import force from '@/shaders/fluid-force.glsl'
import pressure from '@/shaders/fluid-pressure.glsl'
import project from '@/shaders/fluid-project.glsl'
import type { ShaderUniforms } from '@/types/shader'

// The passes that carry annotated uniforms, for the rail to read
export const FLUID_CONTROL_SOURCE = `${advect}\n${force}`

// Cells along the short side of the canvas
const SIM_CELLS = 256
const DYE_CELLS = 1024
const JACOBI_STEPS = 20
// Width of a splat, as a fraction of the canvas height, squared
const SPLAT_RADIUS = 0.0012
const SPLAT_DYE = 0.35
const SEED_DYE = 1.5

const PASSES = {
  'fluid-advect': advect,
  'fluid-force': force,
  'fluid-divergence': divergence,
  'fluid-pressure': pressure,
  'fluid-project': project
}

interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

// Two targets per field: each pass reads one and writes the other
interface Field {
  read: Target
  write: Target
}

interface Splat {
  x: number
  y: number
  dx: number
  dy: number
  dye: number
}

const swap = (field: Field) => {
  const read = field.read
  field.read = field.write
  field.write = read
}

/**
 * A stable-fluids solver on half-float textures. Each frame: advect the
 * velocity, add force, take the divergence, solve for pressure, project,
 * advect the dye. The seventh pass, display, is the shader the page shows.
 */
export class FluidSim {
  private gl: WebGL2RenderingContext
  private manager: ShaderManager
  private velocity: Field | null = null
  private dye: Field | null = null
  private pressure: Field | null = null
  private divergence: Target | null = null
  private splats: Splat[] = []

  // Rendering to half-float textures is an extension, and some phones lack it
  static supported(gl: WebGL2RenderingContext): boolean {
    if (!gl.getExtension('EXT_color_buffer_half_float') && !gl.getExtension('EXT_color_buffer_float')) return false
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, 4, 4, 0, gl.RG, gl.HALF_FLOAT, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(framebuffer)
    gl.deleteTexture(texture)
    return complete
  }

  constructor(gl: WebGL2RenderingContext, manager: ShaderManager) {
    this.gl = gl
    this.manager = manager
    gl.getExtension('EXT_color_buffer_half_float')
    gl.getExtension('EXT_color_buffer_float')
    for (const [id, source] of Object.entries(PASSES)) manager.createProgram(id, VERTEX_SHADER, source)
  }

  // Sizes the grids to the canvas's shape, given in CSS pixels so that a
  // change of resolution keeps the fluid. A new shape starts a new one.
  resize(width: number, height: number): void {
    const short = Math.min(width, height)
    const cells = (count: number) => [Math.round((count * width) / short), Math.round((count * height) / short)]
    const [simWidth, simHeight] = cells(SIM_CELLS)
    if (this.velocity?.read.width === simWidth && this.velocity.read.height === simHeight) return

    const gl = this.gl
    const [dyeWidth, dyeHeight] = cells(DYE_CELLS)
    this.release()
    this.velocity = this.field(simWidth, simHeight, gl.RG16F, gl.RG, gl.LINEAR)
    this.pressure = this.field(simWidth, simHeight, gl.R16F, gl.RED, gl.NEAREST)
    this.divergence = this.target(simWidth, simHeight, gl.R16F, gl.RED, gl.NEAREST)
    this.dye = this.field(dyeWidth, dyeHeight, gl.R16F, gl.RED, gl.LINEAR)
    this.seed()
  }

  // Empties every field and stirs in a few splats so there is something to see
  reset(): void {
    const gl = this.gl
    for (const target of this.targets()) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    this.seed()
  }

  // A pointer moved by (dx, dy) to (x, y), all as fractions of the canvas
  // with y pointing up
  splat(x: number, y: number, dx: number, dy: number): void {
    this.splats.push({ x, y, dx, dy, dye: SPLAT_DYE })
  }

  // One time step. `values` holds the annotated uniforms by name.
  step(dt: number, values: ShaderUniforms): void {
    const { velocity, dye, pressure, divergence } = this
    if (!velocity || !dye || !pressure || !divergence) return
    const grid = [velocity.read.width, velocity.read.height]
    const texel = [1 / grid[0], 1 / grid[1]]
    const dyeTexel = [1 / dye.read.width, 1 / dye.read.height]
    this.gl.disable(this.gl.BLEND)

    // 1. Advect velocity
    this.pass('fluid-advect', velocity.write, [velocity.read], {
      ...values, uVelocity: 0, uSource: 0, uGrid: grid, uTexel: texel, uDt: dt, uDye: false
    })
    swap(velocity)

    // 2. Add force. With no pointer movement the pass still runs once, with
    // nothing to add, for its vorticity term.
    const splats = this.splats.length ? this.splats : [{ x: 0, y: 0, dx: 0, dy: 0, dye: 0 }]
    this.splats = []
    splats.forEach((splat, index) => {
      const shape = { uTarget: 0, uPoint: [splat.x, splat.y], uAspect: grid[0] / grid[1], uRadius: SPLAT_RADIUS }
      this.pass('fluid-force', velocity.write, [velocity.read], {
        ...values, ...shape, uTexel: texel, uDye: false,
        // The pointer's velocity in cells per second
        uPush: [(splat.dx * grid[0]) / dt, (splat.dy * grid[1]) / dt],
        // The vorticity term is per frame, not per splat
        uDt: index === 0 ? dt : 0
      })
      swap(velocity)
      if (!splat.dye) return
      this.pass('fluid-force', dye.write, [dye.read], { ...shape, uTexel: dyeTexel, uDye: true, uPush: [splat.dye, 0] })
      swap(dye)
    })

    // 3. Divergence
    this.pass('fluid-divergence', divergence, [velocity.read], { uVelocity: 0, uTexel: texel })

    // 4. Pressure, starting from last frame's answer
    for (let i = 0; i < JACOBI_STEPS; i++) {
      this.pass('fluid-pressure', pressure.write, [pressure.read, divergence], { uPressure: 0, uDivergence: 1, uTexel: texel })
      swap(pressure)
    }

    // 5. Project
    this.pass('fluid-project', velocity.write, [velocity.read, pressure.read], { uVelocity: 0, uPressure: 1, uTexel: texel })
    swap(velocity)

    // 6. Advect dye
    this.pass('fluid-advect', dye.write, [velocity.read, dye.read], {
      ...values, uVelocity: 0, uSource: 1, uGrid: grid, uTexel: dyeTexel, uDt: dt, uDye: true
    })
    swap(dye)
  }

  // Leaves the dye on texture unit 0 and the velocity on unit 1, and the
  // canvas as the target, for the display pass
  bind(): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.velocity?.read.texture ?? null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.dye?.read.texture ?? null)
  }

  // The programs belong to the ShaderManager, which deletes them with its own
  dispose(): void {
    this.release()
  }

  private pass(id: string, to: Target, from: Target[], uniforms: ShaderUniforms): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer)
    gl.viewport(0, 0, to.width, to.height)
    from.forEach((target, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, target.texture)
    })
    this.manager.useProgram(id)
    this.manager.setUniforms(id, uniforms)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private seed(): void {
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.4
      const [x, y] = [Math.cos(angle), Math.sin(angle)]
      this.splats.push({ x: 0.5 + 0.22 * x, y: 0.5 + 0.22 * y, dx: -0.012 * y, dy: 0.012 * x, dye: SEED_DYE })
    }
  }

  private targets(): Target[] {
    const fields = [this.velocity, this.dye, this.pressure].flatMap(field => (field ? [field.read, field.write] : []))
    return this.divergence ? [...fields, this.divergence] : fields
  }

  private release(): void {
    for (const target of this.targets()) {
      this.gl.deleteFramebuffer(target.framebuffer)
      this.gl.deleteTexture(target.texture)
    }
    this.velocity = this.dye = this.pressure = this.divergence = null
  }

  private field(width: number, height: number, internal: number, format: number, filter: number): Field {
    return {
      read: this.target(width, height, internal, format, filter),
      write: this.target(width, height, internal, format, filter)
    }
  }

  private target(width: number, height: number, internal: number, format: number, filter: number): Target {
    const gl = this.gl
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, gl.HALF_FLOAT, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { texture, framebuffer, width, height }
  }
}
