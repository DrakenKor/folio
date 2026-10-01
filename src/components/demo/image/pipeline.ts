import type { FilterCall } from '@/lib/image-filters'
import type { Engine, ImageReply, ImageRequest } from '@/lib/image.worker'

export const MAX_EDGE = 4096
export const PREVIEW_EDGE = 1024

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Contain logic: the largest centred rectangle of the image's aspect inside the box
export function fit(box: Rect, w: number, h: number): Rect {
  if (!w || !h || box.w <= 0 || box.h <= 0) return { x: box.x, y: box.y, w: 0, h: 0 }
  const scale = Math.min(box.w / w, box.h / h)
  return { x: box.x + (box.w - w * scale) / 2, y: box.y + (box.h - h * scale) / 2, w: w * scale, h: h * scale }
}

export const edgeSize = (w: number, h: number, edge: number): [number, number] => {
  const scale = Math.min(1, edge / Math.max(w, h))
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))]
}

// Decode with the long edge capped at 4096
export async function decode(blob: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(blob)
  const [w, h] = edgeSize(bitmap.width, bitmap.height, MAX_EDGE)
  if (w === bitmap.width) return bitmap
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return createImageBitmap(canvas)
}

// Pixels of a source drawn at w x h
export function readPixels(source: CanvasImageSource, w: number, h: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

// Colour bars, a greyscale ramp, fine line pairs, a zone plate and a checkerboard:
// the things a filter visibly changes. Generated here, so no file ships.
export function testChart(): Promise<ImageBitmap> {
  const w = 1536
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const bars = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000']
  bars.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect((i * w) / bars.length, 0, w / bars.length + 1, 300)
  })
  const ramp = ctx.createLinearGradient(0, 0, w, 0)
  ramp.addColorStop(0, '#000000')
  ramp.addColorStop(1, '#ffffff')
  ctx.fillStyle = ramp
  ctx.fillRect(0, 300, w, 60)
  for (let i = 0; i < 16; i++) {
    const v = Math.round((i / 15) * 255)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect((i * w) / 16, 360, w / 16 + 1, 60)
  }
  // Line pairs at periods of 2, 3, 4, 6, 8 and 12 px
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 420, w, 140)
  ctx.fillStyle = '#000000'
  ;[2, 3, 4, 6, 8, 12].forEach((period, cell) => {
    const left = (cell * w) / 6
    for (let x = 0; x < w / 6 - 8; x += period) ctx.fillRect(left + x, cell % 2 ? 420 : 490, period / 2, 70)
  })
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 560, w, h - 560)
  const half = w / 2
  const plate = ctx.createImageData(half, h - 560)
  for (let y = 0; y < plate.height; y++) {
    for (let x = 0; x < half; x++) {
      const dx = x - half / 2
      const dy = y - plate.height / 2
      const v = Math.round(127.5 + 127.5 * Math.cos(0.0009 * (dx * dx + dy * dy)))
      const o = (y * half + x) * 4
      plate.data[o] = plate.data[o + 1] = plate.data[o + 2] = v
      plate.data[o + 3] = 255
    }
  }
  ctx.putImageData(plate, 0, 560)
  for (let y = 0; y < h - 560; y += 32) {
    for (let x = 0; x < half; x += 32) {
      ctx.fillStyle = (x + y) / 32 % 2 ? '#ffffff' : '#000000'
      ctx.fillRect(half + x, 560 + y, 32, 32)
    }
  }
  return createImageBitmap(canvas)
}

export interface RunParams {
  call: FilterCall
  engine: Engine
  w: number
  h: number
  // Handed to the worker, so the caller passes a copy
  pixels: Uint8ClampedArray
}

export interface RunResult {
  pixels: ImageData
  rustMs: number | null
  jsMs: number | null
  maxError: number | null
}

export interface WorkerStatus {
  wasm: boolean
  rawBytes: number | null
}

/**
 * One worker, one request in flight. A newer request replaces any that is
 * waiting, and a reply that is no longer the newest is dropped, so a dragging
 * slider never queues work.
 */
export class ImageClient {
  private worker: Worker
  private inFlight = false
  private newest = 0
  private waiting: { id: number; params: RunParams } | null = null
  private handlers = new Map<number, (result: RunResult | Error) => void>()

  constructor(onStatus: (status: WorkerStatus) => void) {
    this.worker = new Worker(new URL('../../../lib/image.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<ImageReply>) => {
      const reply = event.data
      if (reply.type === 'status') return onStatus({ wasm: reply.wasm, rawBytes: reply.rawBytes })
      if (reply.type !== 'result' && reply.type !== 'error') return
      this.inFlight = false
      const handler = this.handlers.get(reply.id)
      this.handlers.delete(reply.id)
      if (handler && reply.id === this.newest) {
        if (reply.type === 'error') handler(new Error(reply.message))
        else {
          const { w, h } = this.sizes.get(reply.id)!
          handler({
            pixels: new ImageData(new Uint8ClampedArray(reply.buffer), w, h),
            rustMs: reply.rustMs,
            jsMs: reply.jsMs,
            maxError: reply.maxError
          })
        }
      }
      this.sizes.delete(reply.id)
      this.flush()
    }
  }

  private sizes = new Map<number, { w: number; h: number }>()

  get busy() {
    return this.inFlight
  }

  request(params: RunParams, onDone: (result: RunResult | Error) => void) {
    const id = ++this.newest
    if (this.waiting) {
      this.handlers.delete(this.waiting.id)
      this.sizes.delete(this.waiting.id)
    }
    this.handlers.set(id, onDone)
    this.sizes.set(id, { w: params.w, h: params.h })
    this.waiting = { id, params }
    this.flush()
  }

  private flush() {
    if (this.inFlight || !this.waiting) return
    const { id, params } = this.waiting
    this.waiting = null
    this.inFlight = true
    const message: ImageRequest = { type: 'run', id, call: params.call, engine: params.engine, w: params.w, h: params.h, buffer: params.pixels.buffer as ArrayBuffer }
    this.worker.postMessage(message, [message.buffer])
  }

  dispose() {
    this.worker.terminate()
  }
}
