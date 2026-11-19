import { startEnemy } from '../../ai/m3-combat/intents'
import { sharedBuildView } from '../../core/profile'
import { Button } from '../../core/types'
import type { Entity, M3ActionDefinition, M3World, SimEvent } from '../../core/types'
import type { ActorTick } from '../../systems/actors'
import { selectAction } from '../actions'
import { along, clip, distance, shape } from './geometry'
import { chargedRecipe, drawing, eyeOf, hitGroup, record } from './records'

const slots = [Button.Primary, Button.Secondary, Button.Skill1, Button.Skill2, Button.Skill3, Button.Skill4]
type Eligibility = (world: M3World, actor: Entity, card: M3ActionDefinition) => string | null

function advanceHold(world: M3World, actor: Entity) {
  const h = actor.mechanics!.held, a = actor.action
  if (!h || !a?.recipe) return
  const r = a.recipe, m = drawing(world, a.id)!.mechanic
  if (m.kind === 'plinth-blow') {
    if (!h.releasePending) {
      h.eligibleTicks++
      if (h.eligibleTicks < m.autoReleaseAt) return
      actor.mechanics!.rearmButtons |= h.button
    }
    const charge = world.effects.find(e => e.kind === 'counter' && e.ownerId === actor.id && e.recipe.skillId === a.id)!
    if (h.eligibleTicks >= m.chargedAt) {
      a.recipe = charge.recipe
    } else world.effects = world.effects.filter(e => e !== charge)
    a.ageTicks = 0
    actor.mechanics!.held = null
  } else if (m.kind === 'rill-fan') {
    if (h.releasePending) {
      // Enter recovery at the current age, including releases during windup.
      r.timing.windupTicks = Math.max(0, a.ageTicks - 1)
      r.timing.activeTicks = 1
      actor.mechanics!.held = null
      return
    }
    h.eligibleTicks++
    const delta = actor.aim - a.direction
    const turn = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
    const limit = m.maxTurnDegrees * Math.PI / 180
    a.direction += Math.max(-limit, Math.min(limit, turn))
  }
}

export function selectDrawings(world: M3World, states: Map<number, ActorTick>, events: SimEvent[], locked: Eligibility) {
  const view = sharedBuildView(world)
  for (const actor of world.entities) {
    const state = states.get(actor.id)!
    if (actor.ai) { startEnemy(world, actor, state, events); continue }
    if (!actor.character || actor.death || state.paused || actor.knockback || world.encounter?.phase === 'rest') continue
    const mechanics = actor.mechanics!, cmd = state.command
    if (mechanics.held && state.dodgePressed && !actor.cooldowns.dodge) {
      mechanics.rearmButtons |= mechanics.held.button & cmd.buttons
      mechanics.held = null
      actor.action = null
    }
    if (mechanics.held) { advanceHold(world, actor); continue }
    let buttons = cmd.buttons & ~mechanics.rearmButtons
    const eye = eyeOf(world, actor)
    for (const [index, id] of actor.character.loadout.entries()) {
      const bit = slots[index]!
      if (!(buttons & bit)) continue
      const card = id && drawing(world, id)
      if (!card) continue
      const m = card.mechanic
      if (locked(world, actor, card) ||
        ((m.kind === 'plinth-blow' || m.kind === 'rill-fan') && !((cmd.pressedButtons ?? 0) & bit)) ||
        (m.kind === 'open-hem' && (mechanics.counter?.value ?? 0) < m.seamCost) ||
        (m.kind === 'gather-line' && (!eye || drawing(world, eye.recipe.skillId)?.mechanic.kind !== 'cast-loop')) ||
        (m.kind === 'cast-loop' && eye)) buttons &= ~bit
    }
    selectAction(view, actor, { ...state, command: { ...cmd, buttons } }, events)
    const a = actor.action
    if (!a?.recipe || a.startTick !== world.tick) continue
    const r = a.recipe, m = drawing(world, a.id)!.mechanic
    const button = slots[actor.character.loadout.indexOf(a.id)]!
    if (m.kind === 'span-cut') {
      a.groupId = hitGroup(world, actor, a.startTick, actor.id + ':' + a.startTick).id
    } else if (m.kind === 'plinth-blow' || m.kind === 'rill-fan') {
      mechanics.held = { kind: m.kind === 'plinth-blow' ? 'charge' : 'channel', skillId: a.id, button, eligibleTicks: 0, releasePending: false }
      if (m.kind === 'plinth-blow') {
        const full = chargedRecipe(world, actor, r)
        record(world, actor, full, 'counter', shape('disc', actor.pos, 0, 0, 0, r.footprint.reach), world.tick, Number.MAX_SAFE_INTEGER)
      }
      advanceHold(world, actor)
    } else if (m.kind === 'open-hem') {
      if (mechanics.counter) {
        mechanics.counter.value -= m.seamCost
        if (!mechanics.counter.value) mechanics.counter = null
      }
    } else if (m.kind === 'lay-bed') {
      const reach = Math.min(r.footprint.reach, cmd.aim ? distance(actor.pos, cmd.aim) : r.footprint.reach)
      const point = clip(world, actor.pos, along(actor.pos, a.direction, reach))
      // Leg zero holds the locked placement until the actor reaches its active age.
      record(world, actor, r, 'tile', shape('disc', point, a.direction, 0, 0, m.radius), world.tick, Number.MAX_SAFE_INTEGER)
    } else if (m.kind === 'gather-line') {
      eyeOf(world, actor)!.endpoint = { ...actor.pos }
    }
  }
}
