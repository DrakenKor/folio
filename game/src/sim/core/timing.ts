import type { ActionPhase, ActionTiming } from './types'

/** Classify a consumed action age using half-open integer phase boundaries. */
export function actionPhase(timing: ActionTiming, ageTicks: number): ActionPhase {
  if (ageTicks < timing.windupTicks) return 'windup'
  if (ageTicks < timing.windupTicks + timing.activeTicks) return 'active'
  if (ageTicks < timing.windupTicks + timing.activeTicks + timing.recoveryTicks) return 'recovery'
  return 'complete'
}
