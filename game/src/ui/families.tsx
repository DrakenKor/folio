import { useState } from 'react'
import { previewBuild, WEAPON_FAMILIES, type M3World, type WeaponFamily } from '../sim/core'
import { keys, type FieldProps } from './field'
import { Inventory } from './inventory'

export const toolNames = {
  hemblade: 'Hemblade', plumbshoe: 'Plumbshoe', 'verge-reel': 'Verge Reel',
  'hearth-frame': 'Hearth Frame', 'survey-tally': 'Survey Tally'
} as const

const profiles = {
  hemblade: { cue: 'Close two seams, then step through.', icon: 'M14 34L22 26L37 7L37 3L31 6L17 24ZM10 22L23 32M15 28L8 38M24 20L32 10' },
  plumbshoe: { cue: 'Set your weight or catch a strike.', icon: 'M18 34L31 8L26 6L13 31ZM7 24L24 32L21 39L5 35Z' },
  'verge-reel': { cue: 'Cast an eye and choose its return line.', icon: 'M20 6A14 14 0 1 0 20 34A14 14 0 1 0 20 6ZM20 12A8 8 0 1 0 20 28A8 8 0 1 0 20 12ZM29 29L37 37M16 20H24' },
  'hearth-frame': { cue: 'Lay a warm bed and lift the print.', icon: 'M6 7H34V29H6ZM11 12H29V24H11ZM17 29V39H23V29M15 17H25' },
  'survey-tally': { cue: 'Send a dart or comb the air.', icon: 'M20 3L31 12V30L20 38L9 30V12ZM20 12L26 20L20 28L14 20Z' }
} as const

export function ToolGlyph({ tool }: { tool: keyof typeof toolNames }) {
  return <svg className="tool-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d={profiles[tool].icon}/></svg>
}

export function FamilyBench({ props, world, refit }: {
  props: FieldProps; world: M3World; refit: (familyId: WeaponFamily) => void
}) {
  const [gear, showGear] = useState(false)
  const { character: c } = props
  const { actions, itemBases } = world.content.m3
  const item = c.items.find(i => i.id === c.equipment.weapon)
  const equipped = itemBases.find(b => b.role === 'weapon' && b.id === item?.baseId)
  const current = equipped && 'familyId' in equipped ? equipped.familyId : 'hemblade'
  const [tool, select] = useState<keyof typeof toolNames>(current)
  const tally = tool === 'survey-tally'
  const proposal = tally ? null : previewBuild(world, { type: 'refitWeapon', familyId: tool })
  const preview = proposal?.ok ? proposal.value : null
  const name = toolNames[tool]
  const base = itemBases.find(b => 'familyId' in b ? b.familyId === tool : tally && b.role === 'survey-tally')
  const slotName = (id: string | null) => actions.find(a => a.id === id)?.name ?? 'Empty'
  const locked = c.equipment['survey-tally'] === null
  return <div className="m3-bench">
    <nav className="bench-tabs" aria-label="Inventory sections">
      <button aria-pressed={!gear} onClick={() => showGear(false)}>Tool bench</button>
      <button aria-pressed={gear} onClick={() => showGear(true)}>Gear & stores</button>
    </nav>
    {gear ? <Inventory {...props}/> : <div className="folio-layout">
      <section className="paper bench-paper">
        <h2>Choose a tool head</h2>
        <div className="family-grid">{WEAPON_FAMILIES.map(family =>
          <button key={family} aria-label={toolNames[family]} aria-pressed={tool === family} onClick={() => { select(family); props.report('') }}>
            <ToolGlyph tool={family}/><strong>{toolNames[family]}</strong>
            <span>{family === current ? 'Equipped' : profiles[family].cue}</span>
          </button>)}</div>
        <button className="tally-card" aria-pressed={tally} onClick={() => { select('survey-tally'); props.report('') }}>
          <ToolGlyph tool="survey-tally"/><strong>Survey casts</strong><span>{locked ? 'Locked · Equip a Survey Tally' : 'Survey Tally equipped'}</span>
        </button>
      </section>
      <aside className="ink bench-detail">
        <small>{tally ? 'Casting tool' : 'Refit preview'}</small><h2>{name}</h2>
        <p>{profiles[tool].cue}</p>
        {tally ? <p>{locked ? 'Equip a Survey Tally to bind Fold Dart and Rill Fan.' : 'Fold Dart and Rill Fan are available.'}</p> :
          <><p>{base?.weaponDamage.weight} base weight · Item № {item?.id} keeps its rolls.</p>
            <dl className="m3-slots">{(preview?.loadout ?? c.loadout).map((id, index) => <div key={keys[index]}>
              <dt>{keys[index]}</dt><dd>{slotName(id)}{id !== c.loadout[index] && <small>Reassigned</small>}</dd>
            </div>)}</dl>
            <button className="primary" disabled={!preview?.result.accepted} onClick={() => refit(tool)}>Confirm refit</button>
            {preview && !preview.result.accepted && <p>{world.encounter?.phase !== 'rest' ? 'Return to the marker to refit.' : preview.result.reason}</p>}</>}
      </aside>
    </div>}
  </div>
}
