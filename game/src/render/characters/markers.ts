/** Measured KayKit frames at 30 Hz; measurement notes live in MARKERS.md. */
const frames = (contact: number, recovery: number, end: number, loop = false, offset = 0) =>
  Object.freeze({ start: 0, contact: contact / 30, recovery: recovery / 30, end: end / 30, loop, offset })

export const CLIP_MARKERS = Object.freeze({
  idle: frames(0, 32, 32, true),
  walk: frames(6.833333333333333, 22.833333333333332, 32, true, 0.21354166666666674),
  run: frames(4.5, 16.5, 24, true, 0.1875),
  attack: frames(18, 20, 32),
  attack_slice: frames(12, 14, 30),
  attack_stab: frames(12, 24, 48),
  cast: frames(8, 10, 28),
  cast_long: frames(46, 48, 76),
  dodge: frames(0, 8, 12),
  block: frames(0, 32, 32, true),
  hit: frames(3, 4, 20),
  death: frames(16, 17, 24)
})

export type ClipName = keyof typeof CLIP_MARKERS
export const CLIP_NAMES = Object.keys(CLIP_MARKERS) as ClipName[]
