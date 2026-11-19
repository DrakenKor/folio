import { Button, fmath, IDLE_COMMAND } from '../src/sim/core'
import type { Command, Vec2 } from '../src/sim/core'

export type Policy = 'competent' | 'greedy' | 'idle'
export interface Warning {
  id: number
  sourceId: number
  startTick: number
  dueTick: number
  footprint: { kind: 'disc' | 'sector' | 'lane'; origin: Vec2; direction: number; radius: number; reach: number; halfWidth: number; arcRadians: number }
}
export interface Sight {
  tick: number
  pos: Vec2
  enemies: { id: number; pos: Vec2 }[]
  warnings: Warning[]
}
const offsets = [[1, 0], [.7071, .7071], [0, 1], [-.7071, .7071], [-1, 0], [-.7071, -.7071], [0, -1], [.7071, -.7071]]
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)

/** Signed clearance from the visible warning; positive points are outside the ink. */
export function clearance(point: Vec2, warning: Warning) {
  const f = warning.footprint, x = point.x - f.origin.x, z = point.z - f.origin.z
  if (f.kind === 'disc') return Math.hypot(x, z) - f.radius
  const along = x * fmath.cos(f.direction) + z * fmath.sin(f.direction), side = -x * fmath.sin(f.direction) + z * fmath.cos(f.direction)
  if (f.kind === 'lane') return Math.max(-along, along - f.reach, Math.abs(side) - f.halfWidth)
  return Math.max(Math.hypot(x, z) - f.reach, Math.abs(side) * fmath.cos(f.arcRadians / 2) - along * fmath.sin(f.arcRadians / 2))
}

/** The caller delivers one six-tick-old observation. No RNG or future contacts enter this policy. */
export function decide(sight: Sight | undefined, family: string, policy: Policy): Command {
  if (!sight || policy === 'idle') return IDLE_COMMAND
  const { pos } = sight, target = [...sight.enemies].sort((a, b) => distance(a.pos, pos) - distance(b.pos, pos) || a.id - b.id)[0]
  if (!target) return IDLE_COMMAND
  const range = distance(target.pos, pos), dx = (target.pos.x - pos.x) / Math.max(range, .001), dz = (target.pos.z - pos.z) / Math.max(range, .001)
  const melee = family === 'hemblade', beat = sight.tick % (melee ? 94 : 114)
  // Hold cuts through two recoveries, then attempt the seam spender. Reel combs first, lays the eye, and recalls it.
  let buttons: number = melee ? (beat < 58 ? Button.Primary : Button.Secondary) : (beat < 24 ? Button.Skill2 : beat < 64 ? Button.Primary : Button.Secondary)
  if (range > (melee ? 1.75 : 7)) buttons = 0
  const command = { aim: { ...target.pos }, move: { x: 0, z: 0 }, buttons }
  if (policy === 'greedy') return command
  const desired = melee ? 1.05 : 3.0
  const direction = range > desired + .2 ? 1 : range < desired - .35 ? -1 : 0
  command.move = { x: dx * direction, z: dz * direction }
  const threats = sight.warnings.filter(w => clearance(pos, w) < .4)
  if (threats.length) {
    const score = ([x, z]: number[]) => Math.min(...threats.map(w => clearance({ x: pos.x + x! * 2, z: pos.z + z! * 2 }, w)))
    const [x, z] = [...offsets].sort((a, b) => score(b) - score(a))[0]!
    command.move = { x: x!, z: z! }
    // Defer dodge until its immunity window can cover contact, while walking out immediately.
    if (threats.some(w => w.dueTick - sight.tick - 6 <= 7)) command.buttons |= Button.Dodge
  }
  return command
}
