// A canvas cannot read CSS custom properties, so these mirror the tokens in
// src/app/(demos)/demos.css. They add no colour of their own.
export const COLORS = {
  black: '#000000',
  white: '#ffffff',
  dim: '#8b8b8b',
  bone: '#d1d1d1',
  line: 'rgba(255, 255, 255, 0.12)',
  teal: '#5eead4',
  amber: '#facc15',
  pink: '#ff5b8d'
}

export const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
]

// A small seeded generator, so a shuffle or a set of weights can be repeated
export const mulberry32 = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const RAIL = 368
const GUTTER = 24
const TOP = 108
const WIDE = 1080
// Room for the shell's "Paused. Play" pill, which sits at the bottom centre
const PILL = 56

/**
 * Where an inset sits over the stage, in CSS pixels: beside the rail at the
 * bottom on a wide stage, under the tabs on a narrow one.
 */
export function insetSlot(stageWidth: number, stageHeight: number, width: number, height: number) {
  if (stageWidth >= WIDE) return { x: stageWidth - RAIL - width, y: stageHeight - GUTTER - PILL - height, width, height }
  const scale = Math.min(1, (stageWidth * 0.4) / width)
  return { x: stageWidth < 768 ? 16 : GUTTER, y: TOP, width: width * scale, height: height * scale }
}
