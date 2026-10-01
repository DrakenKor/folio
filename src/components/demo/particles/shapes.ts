// Where each point's home comes from. Homes are in stage units: the stage is
// 2 tall with y up, so an image of any aspect maps with its proportions intact.

export type Shape = 'portrait' | 'name' | 'galaxy' | 'lattice' | 'none'

export interface Raster {
  width: number
  height: number
  data: ArrayLike<number> // RGBA, as ImageData
}

export interface Homes {
  homes: Float32Array
  // Widest extent from the centre, to fit the shape to the stage
  halfWidth: number
}

const PORTRAIT_SOURCE = '/profile.svg'
const NAME = 'Manav Da'

// Light means brighter than half once composited on black
const isLight = (data: ArrayLike<number>, i: number) =>
  ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * (data[i + 3] / 255) > 0.5

/**
 * One home per point, each picked at random from the light pixels and jittered
 * by up to a pixel. A source with no light pixels puts every home at the centre.
 */
export function sampleHomes(raster: Raster, count: number, random: () => number = Math.random): Homes {
  const { width, height, data } = raster
  const light: number[] = []
  for (let i = 0; i < width * height; i++) if (isLight(data, i * 4)) light.push(i)

  const homes = new Float32Array(count * 2)
  if (!light.length) return { homes, halfWidth: 1 }

  const half = height / 2
  let halfWidth = 0
  for (let n = 0; n < count; n++) {
    const pixel = light[Math.floor(random() * light.length)]
    const x = (pixel % width) + 0.5 + (random() * 2 - 1)
    const y = Math.floor(pixel / width) + 0.5 + (random() * 2 - 1)
    homes[n * 2] = (x - width / 2) / half
    homes[n * 2 + 1] = -(y - half) / half
    halfWidth = Math.max(halfWidth, Math.abs(homes[n * 2]))
  }
  return { homes, halfWidth }
}

const gaussian = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())

function galaxy(count: number): Homes {
  const homes = new Float32Array(count * 2)
  for (let n = 0; n < count; n++) {
    let x: number
    let y: number
    if (Math.random() < 0.2) {
      x = gaussian() * 0.12
      y = gaussian() * 0.12
    } else {
      // Two arms of a logarithmic spiral, fuzzier toward the rim
      const theta = Math.random() * 4 * Math.PI
      const r = 0.07 * Math.exp(0.2 * theta)
      const angle = theta + (Math.random() < 0.5 ? 0 : Math.PI)
      const spread = 0.02 + 0.05 * r
      x = r * Math.cos(angle) + gaussian() * spread
      y = r * Math.sin(angle) + gaussian() * spread
    }
    homes[n * 2] = x
    homes[n * 2 + 1] = y
  }
  return { homes, halfWidth: 1 }
}

// A grid of diamond outlines, the home page's motif
function lattice(count: number): Homes {
  const cols = 24
  const rows = 16
  const cell = 0.125
  const radius = 0.04
  const corners = [
    [radius, 0],
    [0, radius],
    [-radius, 0],
    [0, -radius]
  ]
  const homes = new Float32Array(count * 2)
  for (let n = 0; n < count; n++) {
    const cx = (Math.floor(Math.random() * cols) + 0.5 - cols / 2) * cell
    const cy = (Math.floor(Math.random() * rows) + 0.5 - rows / 2) * cell
    const along = Math.random() * 4
    const side = Math.floor(along)
    const t = along - side
    const from = corners[side]
    const to = corners[(side + 1) % 4]
    homes[n * 2] = cx + from[0] + (to[0] - from[0]) * t
    homes[n * 2 + 1] = cy + from[1] + (to[1] - from[1]) * t
  }
  return { homes, halfWidth: (cols * cell) / 2 }
}

const rasterise = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Raster => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  draw(ctx)
  return { width, height, data: ctx.getImageData(0, 0, width, height).data }
}

async function portraitRaster(): Promise<Raster> {
  const image = new Image()
  image.src = PORTRAIT_SOURCE
  await image.decode()
  // Twice the SVG's own 430 x 619
  return rasterise(860, 1238, ctx => ctx.drawImage(image, 0, 0, 860, 1238))
}

async function nameRaster(family: string): Promise<Raster> {
  await document.fonts.load(`800 100px ${family}`)
  await document.fonts.ready
  const size = 360
  const font = `800 ${size}px ${family}`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  measure.fontVariantCaps = 'small-caps'
  const width = Math.ceil(measure.measureText(NAME).width) + 80
  return rasterise(width, Math.round(size * 1.3), ctx => {
    ctx.font = font
    ctx.fontVariantCaps = 'small-caps'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(NAME, width / 2, (size * 1.3) / 2)
  })
}

// Source rasters are drawn once per page; resampling for a new count is cheap
const rasters = new Map<string, Promise<Raster>>()

/**
 * The homes for a shape, one per point. `family` is the CSS font-family for
 * the name. 'none' has no homes.
 */
export async function buildHomes(shape: Shape, count: number, family: string): Promise<Homes | null> {
  if (shape === 'galaxy') return galaxy(count)
  if (shape === 'lattice') return lattice(count)
  if (shape === 'none') return null
  const key = shape === 'name' ? `name ${family}` : shape
  if (!rasters.has(key)) rasters.set(key, shape === 'name' ? nameRaster(family) : portraitRaster())
  return sampleHomes(await rasters.get(key)!, count)
}
