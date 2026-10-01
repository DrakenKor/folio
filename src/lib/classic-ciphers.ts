// Classical ciphers and the one breaker the demo builds, plus two measuring helpers.

const A = 65
const LETTERS = 26

// Relative frequency of each letter in English text, percent, a to z
export const ENGLISH_FREQUENCIES = [
  8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406,
  6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.36, 0.15, 1.974, 0.074
]

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Applies a letter-to-letter map, keeping case and leaving everything else alone
function mapLetters(text: string, map: (index: number) => number): string {
  return text.replace(/[a-z]/gi, char => {
    const base = char <= 'Z' ? A : A + 32
    return String.fromCharCode(base + map(char.charCodeAt(0) - base))
  })
}

export function caesarEncrypt(text: string, shift: number): string {
  return mapLetters(text, index => (((index + shift) % LETTERS) + LETTERS) % LETTERS)
}

export function caesarDecrypt(text: string, shift: number): string {
  return caesarEncrypt(text, -shift)
}

/** Share of each letter a to z among the letters of the text (all zero if there are none). */
export function letterFrequencies(text: string): number[] {
  const counts = new Array<number>(LETTERS).fill(0)
  let total = 0
  for (const match of text.toLowerCase().matchAll(/[a-z]/g)) {
    counts[match[0].charCodeAt(0) - A - 32] += 1
    total += 1
  }
  return counts.map(count => (total ? count / total : 0))
}

/** Chi-squared distance of the text from English: lower is more English-like. */
function englishScore(text: string): number {
  const observed = letterFrequencies(text)
  return observed.reduce((sum, share, index) => {
    const expected = ENGLISH_FREQUENCIES[index] / 100
    return sum + (share - expected) ** 2 / expected
  }, 0)
}

/** Tries all 26 shifts. `scores[shift]` is the distance of that decryption from English. */
export function breakCaesar(ciphertext: string): { shift: number; scores: number[] } {
  const scores = Array.from({ length: LETTERS }, (_, shift) => englishScore(caesarDecrypt(ciphertext, shift)))
  return { shift: scores.indexOf(Math.min(...scores)), scores }
}

export function isSubstitutionKey(key: string): boolean {
  return /^[a-z]{26}$/i.test(key) && new Set(key.toLowerCase()).size === LETTERS
}

// Key letter i replaces alphabet letter i
export function substitutionEncrypt(text: string, key: string): string {
  const lower = key.toLowerCase()
  return mapLetters(text, index => lower.charCodeAt(index) - A - 32)
}

export function substitutionDecrypt(text: string, key: string): string {
  const lower = key.toLowerCase()
  return mapLetters(text, index => lower.indexOf(String.fromCharCode(A + 32 + index)))
}

export function xorEncrypt(text: string, key: string): Uint8Array {
  const keyBytes = textEncoder.encode(key)
  return textEncoder.encode(text).map((byte, index) => byte ^ keyBytes[index % keyBytes.length])
}

export function xorDecrypt(data: Uint8Array, key: string): string {
  const keyBytes = textEncoder.encode(key)
  return textDecoder.decode(data.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Shannon entropy in bits per Unicode code point. */
export function shannonEntropy(text: string): number {
  const counts = new Map<string, number>()
  let total = 0
  for (const point of text) {
    counts.set(point, (counts.get(point) ?? 0) + 1)
    total += 1
  }
  let sum = 0
  for (const count of counts.values()) sum += (count / total) * Math.log2(count / total)
  return 0 - sum
}

/** Number of bits that differ between two equal-length byte strings. */
export function bitDifference(left: Uint8Array, right: Uint8Array): number {
  let count = 0
  for (let index = 0; index < left.length; index += 1) {
    let diff = left[index] ^ right[index]
    while (diff) {
      count += diff & 1
      diff >>= 1
    }
  }
  return count
}
