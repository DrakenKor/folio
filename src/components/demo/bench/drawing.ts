// Plain canvas drawing for the benchmark pictures. Each function takes a 2D context
// and the data a workload's race chunk or preview carries.

export type Rgb = [number, number, number]

export const GRID = 256

export interface MandelChunk { y0: number; y1: number; width: number; rows: Uint8Array }

export function parseColor(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)
  if (!hex) return fallback
  const n = parseInt(hex[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const clear = (ctx: CanvasRenderingContext2D) => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

export function sizeCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = width
    ctx.canvas.height = height
  }
}

// Draws the rows of a square Mandelbrot image that fall inside [y0, y1), sampled to a GRID x GRID canvas.
export function drawMandelbrot(ctx: CanvasRenderingContext2D, chunk: MandelChunk, tint: Rgb) {
  sizeCanvas(ctx, GRID, GRID)
  const { y0, y1, width, rows } = chunk
  const row = ctx.createImageData(GRID, 1)
  for (let ty = 0; ty < GRID; ty++) {
    const sy = Math.floor((ty * width) / GRID)
    if (sy < y0 || sy >= y1) continue
    for (let tx = 0; tx < GRID; tx++) {
      const v = rows[(sy - y0) * width + Math.floor((tx * width) / GRID)]
      const b = v >= 255 ? 0 : Math.min(1, 0.2 + v / 40)
      const o = tx * 4
      row.data[o] = tint[0] * b
      row.data[o + 1] = tint[1] * b
      row.data[o + 2] = tint[2] * b
      row.data[o + 3] = 255
    }
    ctx.putImageData(row, 0, ty)
  }
}

const BODY_EXTENT = 15

export function drawBodies(ctx: CanvasRenderingContext2D, positions: Float64Array, tint: Rgb) {
  sizeCanvas(ctx, GRID, GRID)
  clear(ctx)
  ctx.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`
  for (let i = 0; i + 1 < positions.length; i += 2) {
    const x = ((positions[i] + BODY_EXTENT) / (2 * BODY_EXTENT)) * GRID
    const y = ((positions[i + 1] + BODY_EXTENT) / (2 * BODY_EXTENT)) * GRID
    if (x >= 0 && x < GRID && y >= 0 && y < GRID) ctx.fillRect(x, y, 2, 2)
  }
}

export function drawHeat(ctx: CanvasRenderingContext2D, heat: { size: number; data: Float64Array }) {
  const { size, data } = heat
  sizeCanvas(ctx, size, size)
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < data.length; i++) {
    if (data[i] < lo) lo = data[i]
    if (data[i] > hi) hi = data[i]
  }
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < data.length; i++) {
    const t = hi > lo ? (data[i] - lo) / (hi - lo) : 0
    const g = 20 + 220 * t
    image.data[i * 4] = g
    image.data[i * 4 + 1] = g
    image.data[i * 4 + 2] = g
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
}

// The primes under 10,000 laid on a square spiral, 1 in the centre.
export function drawUlam(ctx: CanvasRenderingContext2D, small: Uint32Array) {
  const side = 102
  sizeCanvas(ctx, side, side)
  clear(ctx)
  const isPrime = new Set(small)
  ctx.fillStyle = '#d1d1d1'
  let x = side / 2
  let y = side / 2
  let dx = 1
  let dy = 0
  let length = 1
  let left = 1
  let turns = 0
  for (let n = 1; n < 10_000; n++) {
    if (isPrime.has(n)) ctx.fillRect(x, y, 1, 1)
    x += dx
    y += dy
    if (--left === 0) {
      ;[dx, dy] = [-dy, dx]
      if (++turns % 2 === 0) length++
      left = length
    }
  }
}

export function drawSort(ctx: CanvasRenderingContext2D, sort: { before: Float64Array; after: Float64Array }) {
  const w = GRID
  const h = 96
  sizeCanvas(ctx, w, h)
  clear(ctx)
  const line = (values: Float64Array, color: string) => {
    let hi = 0
    for (const v of values) if (v > hi) hi = v
    ctx.strokeStyle = color
    ctx.beginPath()
    values.forEach((v, i) => {
      const px = (i / Math.max(1, values.length - 1)) * (w - 2) + 1
      const py = h - 2 - (hi > 0 ? v / hi : 0) * (h - 4)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
  line(sort.before, 'rgba(255, 255, 255, 0.35)')
  line(sort.after, '#ffffff')
}

// Chooses by the shape of a result's preview.
export function drawPreview(ctx: CanvasRenderingContext2D, preview: unknown, tint: Rgb) {
  const p = preview as Record<string, unknown> | null
  if (!p) return
  if (p.data instanceof Uint8Array && typeof p.width === 'number') {
    const width = p.width as number
    drawMandelbrot(ctx, { y0: 0, y1: p.height as number, width, rows: p.data as Uint8Array }, tint)
  } else if (p.positions instanceof Float64Array) drawBodies(ctx, p.positions, tint)
  else if (p.data instanceof Float64Array) drawHeat(ctx, p as { size: number; data: Float64Array })
  else if (p.small instanceof Uint32Array) drawUlam(ctx, p.small)
  else if (p.before instanceof Float64Array) drawSort(ctx, p as { before: Float64Array; after: Float64Array })
}
