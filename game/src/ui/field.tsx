import type { createAPI } from '../debug/api'
import type { CharacterState, EquipmentRole, M2Content, StatModifier, World } from '../sim/core/types'

export interface FieldProps {
  world: World
  character: CharacterState
  content: M2Content
  api: ReturnType<typeof createAPI>
  report: (text: string) => void
}

export const keys = ['LMB', 'RMB', 'Q', 'E', 'R', 'T']
export const words = (id: string) => id.replaceAll('-', ' ').replace(/^./, c => c.toUpperCase())
export const num = (value: number) => String(Number(value.toFixed(5)))
export const signed = (value: number) => (value > 0 ? '+' : '') + num(value)
export const pct = (value: number) => num(value * 100) + '%'
export function modifier(m: StatModifier) {
  const scope = [...m.requiredTags, ...m.types].join(' ')
  switch (m.kind) {
    case 'conversion': return pct(m.value) + ' ' + m.from + ' → ' + m.to
    case 'flat': return [signed(m.value), m.damageType, scope, 'damage'].filter(Boolean).join(' ')
    case 'multiplier': return [scope, 'damage multiplier ×' + m.value.toFixed(2)].filter(Boolean).join(' ')
    case 'boost': return (m.value >= 0 ? '+' : '') + pct(m.value) + ' ' + [scope, 'boost'].filter(Boolean).join(' ')
    case 'reduction': return pct(m.value) + ' ' + m.damageType + ' reduction'
    case 'reachMultiplier': return scope + ' reach ×' + m.value.toFixed(2)
    case 'healthMultiplier': return 'Health ×' + m.value.toFixed(2)
    case 'movement': case 'reach': return '+' + pct(m.value) + ' ' + [scope, m.kind].filter(Boolean).join(' ')
    case 'health': return signed(m.value) + ' health'
    default: return signed(m.value) + ' ticks ' + m.kind.replace(/([A-Z])/g, ' $1').toLowerCase()
  }
}
const paths: Record<EquipmentRole, string> = {
  weapon: 'M8 32L27 8L32 5L30 13L12 34ZM5 24L19 35M10 30L4 38',
  offhand: 'M7 10L20 4L33 10L31 24L20 36L9 24ZM20 7V31M9 12L20 17L31 12',
  coat: 'M14 6L20 11L26 6L35 14L30 21L26 18L29 35L11 35L14 18L10 21L5 14ZM20 11V34',
  boots: 'M14 6H27L24 22L33 29L34 33H11L10 28L15 20ZM13 27L23 26M15 12H25',
  'survey-tally': 'M10 11L20 4L30 11V32L20 37L10 32ZM20 12L25 19L20 26L15 19ZM15 30H25'
}
export function Emblem({ role }: { role: EquipmentRole }) {
  return <svg viewBox="0 0 40 40" className="emblem" aria-hidden="true"><path d={paths[role]} /></svg>
}
