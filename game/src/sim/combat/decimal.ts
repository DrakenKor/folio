// Authored damage and rates are short decimals. Use their integer numerators
// while the intermediate fits exactly, including when binary 1.15 * 50 falls below 57.5.
function scale(value: number): number {
  let scale = 1
  while (scale <= Number.MAX_SAFE_INTEGER) {
    const numerator = Math.round(value * scale)
    if (Number.isSafeInteger(numerator) && numerator / scale === value) return scale
    scale *= 10
  }
  return 0
}

export function multiply(a: number, b: number): number {
  if (Number.isInteger(a) && Number.isInteger(b) || a === 0 || b === 0 || a === 1 || b === 1) return a * b
  const x = scale(a), y = scale(b)
  if (!x || !y) return a * b
  const numerator = Math.round(a * x) * Math.round(b * y)
  return Number.isSafeInteger(numerator) && Number.isSafeInteger(x * y) ? numerator / (x * y) : a * b
}

export function add(a: number, b: number): number {
  if (a === 0 || b === 0 || Number.isInteger(a) && Number.isInteger(b)) return a + b
  const x = scale(a), y = scale(b)
  if (!x || !y) return a + b
  const common = Math.max(x, y)
  const left = Math.round(a * x) * (common / x), right = Math.round(b * y) * (common / y)
  return Number.isSafeInteger(left) && Number.isSafeInteger(right) && Number.isSafeInteger(left + right) ? (left + right) / common : a + b
}
