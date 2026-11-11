import { actionPhase } from '../sim/core/index'
import type { World } from '../sim/core/types'
import { encounterOutcome } from '../sim/scenarios'
import './hud.css'

/** Minimal encounter HUD; all availability and outcomes are derived from the current world. */
export function createHUD(restart: () => void) {
  const root = document.createElement('section')
  root.id = 'encounter-hud'
  root.setAttribute('aria-label', 'Combat status')
  root.innerHTML = `<div class="hud-vital"><span>WINDSTEP CLEARING</span><strong data-health></strong><div class="hud-health-track"><i></i></div></div>
    <div class="hud-actions">${[['LMB', 'Span Cut'], ['RMB', 'Fold Dart'], ['SPACE', 'Dodge']].map(([key, label]) =>
      `<div class="hud-action"><kbd>${key}</kbd><b>${label}</b><span>Ready</span><i></i></div>`).join('')}</div>
    <p class="hud-help">WASD move · Mouse aim · Wheel zoom · Shift + wheel turn</p>
    <div class="hud-outcome" hidden><div><span>WINDSTEP CLEARING</span><h1></h1><p></p><button type="button">Try again</button></div></div>`
  document.body.append(root)
  const health = root.querySelector<HTMLElement>('[data-health]')!
  const healthFill = root.querySelector<HTMLElement>('.hud-health-track i')!
  const actions = [...root.querySelectorAll<HTMLElement>('.hud-action')]
  const outcome = root.querySelector<HTMLElement>('.hud-outcome')!
  root.querySelector('button')!.onclick = restart

  return {
    sync(world: World): void {
      const player = world.entities.find(actor => actor.id === world.playerId)
      root.hidden = !player
      if (!player) return
      health.textContent = `${player.health} / ${player.maxHealth}`
      healthFill.style.width = `${100 * player.health / player.maxHealth}%`
      const action = player.action
      const timing = action?.kind === 'dodge' ? world.content.dodge.timing : world.content.skills.find(skill => skill.id === action?.id)?.timing
      const phase = action && timing ? actionPhase(timing, action.ageTicks) : null
      const blocked = !!(player.death || player.impactPauseTicks || player.knockback)
      for (const [i, slot] of (['primary', 'secondary', 'dodge'] as const).entries()) {
        const isDodge = slot === 'dodge'
        const current = action && (isDodge ? action.kind === 'dodge' : action.id === player.skills[slot])
        const cooldown = player.cooldowns[slot]
        const available = !blocked && cooldown === 0 && (isDodge ? !action || action.kind !== 'dodge' && phase !== 'active' : !action)
        const state = player.death ? 'Fallen' : current ? phase === 'recovery' ? 'Recovering' : isDodge ? 'Dodging' : 'Attacking' :
          cooldown ? `${(cooldown / 60).toFixed(1)}s` : available ? 'Ready' : 'Waiting'
        const total = timing ? timing.windupTicks + timing.activeTicks + timing.recoveryTicks : 1
        const progress = available ? 1 : current ? action!.ageTicks / total : isDodge ? 1 - cooldown / world.content.dodge.cooldownTicks : 0
        actions[i]!.dataset.ready = String(available)
        actions[i]!.querySelector('span')!.textContent = state
        actions[i]!.style.setProperty('--ready', `${Math.max(0, Math.min(1, progress)) * 100}%`)
      }
      const result = world.scenario.startsWith('m1-') ? encounterOutcome(world, world.scenario) : 'ongoing'
      outcome.hidden = result === 'ongoing'
      if (result !== 'ongoing') {
        outcome.querySelector('h1')!.textContent = result === 'victory' ? 'The way is open' : 'The meadow holds'
        outcome.querySelector('p')!.textContent = result === 'victory' ? 'Clearing restored' : 'Read the windup. Find your opening.'
        outcome.querySelector('button')!.textContent = result === 'victory' ? 'Fight again' : 'Try again'
      }
    },
    dispose(): void { root.remove() }
  }
}
