export interface Environment {
  browser: string
  cores: string
  timer: number | null
  simd: boolean
  noWorker: boolean
}

// A v128 constant dropped: valid only where WebAssembly SIMD is supported.
const SIMD_MODULE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])

export function shortBrowser(ua: string): string {
  const match = ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/)
  const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  const name = match ? `${names[match[1]] ?? match[1]} ${match[2]}` : 'Unknown browser'
  return os ? `${name} on ${os}` : name
}

// The smallest non-zero step performance.now() takes over a short spin.
export function timerResolution(): number | null {
  const start = performance.now()
  let last = start
  let smallest = Infinity
  for (let t = start; t - start < 25; t = performance.now()) {
    if (t > last) {
      smallest = Math.min(smallest, t - last)
      last = t
    }
  }
  return Number.isFinite(smallest) ? smallest : null
}

export function readEnvironment(noWorker: boolean): Environment {
  return {
    browser: shortBrowser(navigator.userAgent),
    cores: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'not reported',
    timer: timerResolution(),
    simd: typeof WebAssembly !== 'undefined' && WebAssembly.validate(SIMD_MODULE),
    noWorker,
  }
}
