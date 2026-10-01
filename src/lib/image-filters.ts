import type { WasmExports } from '@/lib/wasm'

// JavaScript twins of the Rust primitives in wasm/src/image.rs. Same edge
// policy (clamp to nearest pixel), same rounding (floor(x + 0.5), clamped),
// same loop order, alpha never modified, one temporary buffer per call.

type Pixels = Uint8ClampedArray | Uint8Array

function round(x: number): number {
  const v = Math.floor(x + 0.5)
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function clampIndex(v: number, max: number): number {
  return v < 0 ? 0 : v > max - 1 ? max - 1 : v
}

function validImage(data: Pixels, w: number, h: number): boolean {
  return w > 0 && h > 0 && data.length === w * h * 4
}

export function convolve(data: Pixels, w: number, h: number, kernel: ArrayLike<number>, ksize: number, divisor: number, bias: number): void {
  if (!validImage(data, w, h) || ksize % 2 === 0 || kernel.length !== ksize * ksize) return
  const r = (ksize - 1) / 2
  const d = divisor === 0 ? 1 : divisor
  const src = new Uint8Array(data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = 0; ky < ksize; ky++) {
          const sy = clampIndex(y + ky - r, h)
          for (let kx = 0; kx < ksize; kx++) {
            const sx = clampIndex(x + kx - r, w)
            sum += kernel[ky * ksize + kx] * src[(sy * w + sx) * 4 + c]
          }
        }
        data[o + c] = round(sum / d + bias)
      }
    }
  }
}

export function colorMatrix(data: Pixels, m: ArrayLike<number>): void {
  if (m.length !== 20) return
  for (let o = 0; o + 3 < data.length; o += 4) {
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const a = data[o + 3]
    for (let c = 0; c < 3; c++) {
      const row = c * 5
      data[o + c] = round(m[row] * r + m[row + 1] * g + m[row + 2] * b + m[row + 3] * a + m[row + 4])
    }
  }
}

export function gaussianBlur(data: Pixels, w: number, h: number, sigma: number): void {
  if (!validImage(data, w, h) || !Number.isFinite(sigma) || sigma <= 0) return
  const radius = Math.min(Math.ceil(3 * sigma), 96)
  const weights = new Float64Array(2 * radius + 1)
  let total = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    weights[i + radius] = v
    total += v
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= total
  // temp starts as a copy so alpha is carried through both passes
  const temp = new Uint8Array(data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let i = -radius; i <= radius; i++) {
          sum += weights[i + radius] * data[(y * w + clampIndex(x + i, w)) * 4 + c]
        }
        temp[o + c] = round(sum)
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let i = -radius; i <= radius; i++) {
          sum += weights[i + radius] * temp[(clampIndex(y + i, h) * w + x) * 4 + c]
        }
        data[o + c] = round(sum)
      }
    }
  }
}

export function sobel(data: Pixels, w: number, h: number): void {
  if (!validImage(data, w, h)) return
  const src = new Uint8Array(data)
  const luma = (x: number, y: number): number => {
    const o = (clampIndex(y, h) * w + clampIndex(x, w)) * 4
    return 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l00 = luma(x - 1, y - 1)
      const l01 = luma(x, y - 1)
      const l02 = luma(x + 1, y - 1)
      const l10 = luma(x - 1, y)
      const l12 = luma(x + 1, y)
      const l20 = luma(x - 1, y + 1)
      const l21 = luma(x, y + 1)
      const l22 = luma(x + 1, y + 1)
      const gx = (l02 + 2 * l12 + l22) - (l00 + 2 * l10 + l20)
      const gy = (l20 + 2 * l21 + l22) - (l00 + 2 * l01 + l02)
      const v = round(Math.sqrt(gx * gx + gy * gy))
      const o = (y * w + x) * 4
      data[o] = v
      data[o + 1] = v
      data[o + 2] = v
    }
  }
}

export type FilterId = 'blur' | 'sharpen' | 'edges' | 'emboss' | 'greyscale' | 'sepia' | 'invert' | 'brightness' | 'contrast' | 'custom'

export type FilterCall =
  | { primitive: 'convolve'; kernel: number[]; ksize: number; divisor: number; bias: number }
  | { primitive: 'colorMatrix'; m: number[] }
  | { primitive: 'gaussianBlur'; sigma: number }
  | { primitive: 'sobel' }

const ALPHA_ROW = [0, 0, 0, 1, 0]

function matrix(r: number[], g: number[], b: number[]): FilterCall {
  return { primitive: 'colorMatrix', m: [...r, ...g, ...b, ...ALPHA_ROW] }
}

export function filterCall(id: FilterId, amount: number, custom?: { kernel: number[]; ksize: number; divisor: number }): FilterCall {
  switch (id) {
    case 'blur':
      return { primitive: 'gaussianBlur', sigma: amount / 2 }
    case 'sharpen': {
      const s = amount
      return { primitive: 'convolve', kernel: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0], ksize: 3, divisor: 1, bias: 0 }
    }
    case 'emboss': {
      const d = amount
      return { primitive: 'convolve', kernel: [-2 * d, -d, 0, -d, 1, d, 0, d, 2 * d], ksize: 3, divisor: 1, bias: 0 }
    }
    case 'edges':
      return { primitive: 'sobel' }
    case 'greyscale':
      return matrix([0.299, 0.587, 0.114, 0, 0], [0.299, 0.587, 0.114, 0, 0], [0.299, 0.587, 0.114, 0, 0])
    case 'sepia':
      return matrix([0.393, 0.769, 0.189, 0, 0], [0.349, 0.686, 0.168, 0, 0], [0.272, 0.534, 0.131, 0, 0])
    case 'invert':
      return matrix([-1, 0, 0, 0, 255], [0, -1, 0, 0, 255], [0, 0, -1, 0, 255])
    case 'brightness': {
      const off = 255 * amount
      return matrix([1, 0, 0, 0, off], [0, 1, 0, 0, off], [0, 0, 1, 0, off])
    }
    case 'contrast': {
      const k = 1 + amount
      const off = 127.5 * (1 - k)
      return matrix([k, 0, 0, 0, off], [0, k, 0, 0, off], [0, 0, k, 0, off])
    }
    case 'custom': {
      if (!custom) throw new Error('filterCall: the custom filter needs a kernel')
      return { primitive: 'convolve', kernel: custom.kernel, ksize: custom.ksize, divisor: custom.divisor, bias: 0 }
    }
  }
}

export function runJs(call: FilterCall, data: Pixels, w: number, h: number): void {
  switch (call.primitive) {
    case 'convolve':
      return convolve(data, w, h, call.kernel, call.ksize, call.divisor, call.bias)
    case 'colorMatrix':
      return colorMatrix(data, call.m)
    case 'gaussianBlur':
      return gaussianBlur(data, w, h, call.sigma)
    case 'sobel':
      return sobel(data, w, h)
  }
}

export function runRust(
  wasm: Pick<WasmExports, 'convolve' | 'color_matrix' | 'gaussian_blur' | 'sobel'>,
  call: FilterCall,
  data: Pixels,
  w: number,
  h: number,
): void {
  // wasm-bindgen copies the slice in and back out; a Uint8Array view over the
  // same buffer makes the result land in the caller's array
  const bytes = data instanceof Uint8ClampedArray ? new Uint8Array(data.buffer, data.byteOffset, data.length) : data
  switch (call.primitive) {
    case 'convolve':
      return wasm.convolve(bytes, w, h, call.kernel, call.ksize, call.divisor, call.bias)
    case 'colorMatrix':
      return wasm.color_matrix(bytes, call.m)
    case 'gaussianBlur':
      return wasm.gaussian_blur(bytes, w, h, call.sigma)
    case 'sobel':
      return wasm.sobel(bytes, w, h)
  }
}
