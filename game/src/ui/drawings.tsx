import { useState } from 'react'
import type { FoldDefinition, Loadout, ResolvedAction } from '../sim/core/types'
import { Damage } from './damage'
import { keys, modifier, num, signed, words, type FieldProps } from './field'

function footprint(recipe: ResolvedAction, scale: number, ghost: boolean) {
  const f = recipe.footprint, r = f.reach * scale
  if (f.kind === 'projectile') return f.projectileAngles.map(a => <g key={a} transform={`rotate(${a})`}>
    <path className={ghost ? 'trace' : 'draft'} d={`M0 0 L${r - 12} -${Math.max(3, f.radius * scale)} L${r} 0 L${r - 12} ${Math.max(3, f.radius * scale)} Z`}/></g>)
  if (f.arcRadians >= Math.PI * 2) return <circle className={ghost ? 'trace' : 'draft'} r={r}/>
  const x = r * Math.cos(f.arcRadians / 2), y = r * Math.sin(f.arcRadians / 2)
  return <path className={ghost ? 'trace' : 'draft'} d={`M0 0L${x} ${-y} A${r} ${r} 0 ${f.arcRadians > Math.PI ? 1 : 0} 1 ${x} ${y}Z`}/>
}

function Drawing({ before, after }: { before: ResolvedAction; after: ResolvedAction }) {
  const f = after.footprint
  const sector = f.kind === 'melee'
  const scale = (sector ? 66 : 205) / Math.max(before.footprint.reach, f.reach)
  const reachChanged = before.footprint.reach !== f.reach
  const changed = reachChanged || before.footprint.arcRadians !== f.arcRadians ||
    before.footprint.radius !== f.radius || before.footprint.projectileAngles.length !== f.projectileAngles.length
  const reachLabel = reachChanged ? `, current reach ${num(before.footprint.reach)} m, proposed reach ${num(f.reach)} m` : ''
  return <div className="blueprint"><svg viewBox={!sector && reachChanged ? '0 18 300 116' : '0 0 300 160'}
    role="img" aria-label={(sector ? 'Sector footprint' : 'Projectile footprint') + reachLabel}>
    <g transform={sector ? 'translate(143 80)' : 'translate(39 76)'}>
      <path className="axis" d="M-145 0H275M0 -76V76"/>
      {footprint(after, scale, false)}{changed && footprint(before, scale, true)}
      {reachChanged ? <>
        <g className="endpoint current" transform={`translate(${before.footprint.reach * scale} 0)`}>
          <path d="M0 5V23h-6"/><circle r="4"/><text x="-8" y="28" textAnchor="end">Current {num(before.footprint.reach)} m</text>
        </g>
        <g className="endpoint proposed" transform={`translate(${f.reach * scale} 0)`}>
          <path d="M0 -5V-25h-6"/><path className="tip" d="M0 -5L5 0L0 5L-5 0Z"/>
          <text x="-8" y="-21" textAnchor="end">Proposed {num(f.reach)} m</text>
        </g></> : !sector && <g className="measure"><path d={`M0 62v7m0 -3H${f.reach * scale}m0 -4v7`}/>
        <text x={f.reach * scale / 2} y="82">{num(f.reach)} m</text></g>}
      <circle r="4" className="origin"/></g></svg><div><b>{reachChanged && num(before.footprint.reach) + ' → '}{num(f.reach)} m</b><span>{sector ?
        num(f.arcRadians * 180 / Math.PI) + '° sector' : f.projectileAngles.length + ' dart' + (f.projectileAngles.length === 1 ? '' : 's') + ' · ' + num(f.radius) + ' m radius'}</span></div></div>
}

function effects(f: FoldDefinition) {
  const lines = f.modifiers.map(modifier)
  if (f.reachFactor !== 1) lines.push('Reach ×' + f.reachFactor.toFixed(2))
  if (f.arcFactor !== 1) lines.push('Angle ×' + f.arcFactor.toFixed(2))
  if (f.radiusFactor !== 1) lines.push('Radius ×' + f.radiusFactor.toFixed(2))
  if (f.windupDelta) lines.push('Windup ' + signed(f.windupDelta) + ' ticks')
  if (f.recoveryDelta) lines.push('Recovery ' + signed(f.recoveryDelta) + ' ticks')
  if (f.projectileAngles.length > 1) lines.push(f.projectileAngles.join('°, ') + '° · one hit per target')
  return lines
}

export function Drawings({ world, character: c, content, api, report, initialSlot }: FieldProps & { initialSlot: number }) {
  const [id, setId] = useState(c.loadout[initialSlot] ?? content.actions[0]!.id)
  const [foldId, setFold] = useState<string | null>(null)
  const [tracing, trace] = useState(false)
  const [damage, showDamage] = useState(world.encounter?.phase === 'active')
  const [slot, setSlot] = useState(initialSlot)
  const [targetId, targetSelect] = useState<number>()
  const liveTargets = world.entities.filter(e => e.faction !== 'neutral' && e.faction !== 'player' && e.health > 0)
  const target = liveTargets.find(e => e.id === targetId) ?? liveTargets[0] ?? world.entities.find(e => e.id === world.playerId)!
  const targetName = target.id === world.playerId ? 'your defences' : words(target.kind) + ' № ' + target.id
  const action = content.actions.find(a => a.id === id)!
  const installed = c.folds[id] ?? []
  const fold = content.folds.find(f => f.id === foldId)
  const removing = !!fold && installed.includes(fold.id)
  const ids = fold ? removing ? installed.filter(k => k !== fold.id) : [...installed, fold.id] : installed
  const tension = content.folds.filter(f => ids.includes(f.id)).reduce((total, f) => total + f.tension, 0)
  const proposal = api.character.preview({ type: 'setFolds', skillId: id, foldIds: ids })
  const comparison = proposal.ok ? proposal.value.actions.find(a => a.skillId === id) : undefined
  const legal = proposal.ok && proposal.value.result.accepted
  const current = api.damage(id, target.id)
  if (!current.ok) return <p>{words(current.reason)}</p>
  const before = current.value.recipe
  const after = !tracing && comparison && legal ? comparison.after.recipe : before
  const phases = [['Windup', 'windupTicks'], ['Active', 'activeTicks'], ['Recovery', 'recoveryTicks']] as const
  const tradeoff = comparison && legal ? [
    { label: 'Reach', from: comparison.before.recipe.footprint.reach, to: comparison.after.recipe.footprint.reach, unit: ' m' },
    { label: 'Undefended damage per hit', from: comparison.before.damage.calculated, to: comparison.after.damage.calculated, unit: '' },
    { label: 'Recovery', from: comparison.before.recipe.timing.recoveryTicks, to: comparison.after.recipe.timing.recoveryTicks, unit: ' ticks' },
  ] : []
  const selectFold = (f: FoldDefinition) => { setFold(f.id); trace(false); showDamage(false); report('') }
  return <div className="drawing-layout"><div className="action-index"><small>Action library</small>{content.actions.map(a =>
    <button key={a.id} aria-pressed={a.id === id} onClick={() => {
      setId(a.id); setFold(null); trace(false); report('')
      const assigned = c.loadout.indexOf(a.id)
      if (assigned >= 0) setSlot(assigned)
    }}>
      {a.name}<span>{keys[c.loadout.indexOf(a.id)] ?? '—'}</span></button>)}
    <label className="stack">Loadout slot<select value={slot} onChange={e => setSlot(Number(e.target.value))}>{keys.map((k,i) =>
      <option key={k} value={i}>{k}</option>)}</select></label><span className="slot-owner">{content.actions.find(a => a.id === c.loadout[slot])?.name ?? 'Unassigned'}</span>
    <button disabled={world.encounter?.phase !== 'rest' || c.loadout[slot] === id} onClick={() => {
      const slots: Loadout = [...c.loadout], old = slots.indexOf(id)
      if (old >= 0) slots[old] = slots[slot] ?? null
      slots[slot] = id
      const r = api.character.setLoadout(slots); report(r.accepted ? 'Assigned ' + action.name + ' to ' + keys[slot] : words(r.reason))
    }}>Assign to {keys[slot]}</button></div>
    <div className="paper drawing-paper"><div className="section-title"><div><small>{action.tags.join(' · ')}</small><h2>{action.name}</h2></div>
      <button aria-pressed={damage} onClick={() => showDamage(!damage)}>{damage ? 'Drawing' : 'Damage details'}</button></div>
    {damage ? <><label className="stack">Damage target<select value={target.id} onChange={e => targetSelect(Number(e.target.value))}>
      {(liveTargets.length ? liveTargets : [target]).map(t => <option key={t.id} value={t.id}>{t.id === world.playerId ? 'Your defences' : words(t.kind) + ' № ' + t.id}</option>)}</select></label>
      <Damage preview={current.value} health={target.health} target={targetName}/></> : <>
    <Drawing before={before} after={after}/><div className="phase-strip" aria-hidden="true">{phases.map(([label, key]) =>
      <span key={label} style={{ flexGrow: after.timing[key] }}/>)}</div><div className="phase-labels" aria-label="Action timing in ticks">{phases.map(([label, key]) =>
        <span key={key}>{label} <b>{before.timing[key] !== after.timing[key] && before.timing[key] + ' → '}{after.timing[key]}</b> {after.timing[key] === 1 ? 'tick' : 'ticks'}</span>)}</div>
    <div className="handle-row">{(['reach','spread','material'] as const).map(handle => <button key={handle} aria-label={words(handle) + ' handle'}
      data-selected={fold?.handle === handle} onPointerDown={e => {
        if (fold?.handle === handle) { e.currentTarget.setPointerCapture(e.pointerId); trace(true) }
      }} onPointerMove={e => { if (tracing && e.currentTarget.hasPointerCapture(e.pointerId) && (e.movementX || e.movementY)) trace(false) }}
      onPointerUp={() => trace(false)} onLostPointerCapture={() => trace(false)} onClick={() => {
        if (fold?.handle !== handle) selectFold(content.folds.find(f => f.handle === handle)!)
        else trace(false)
      }}>{words(handle)}</button>)}</div>
    <small>Fold patterns</small><div className="patterns">{content.folds.map(f => <button key={f.id} aria-pressed={f.id === foldId}
      onClick={() => selectFold(f)}>{f.name}{installed.includes(f.id) && ' ✓'}</button>)}</div></>}</div>
    <aside className="ink"><small>{damage ? 'Committed action' : 'Fold preview'}</small><h2>{damage ? 'Damage sources' : fold?.name ?? 'Choose a fold'}</h2>
    {damage ? <><ul className="source-list">{before.modifiers.filter(m =>
      ['flat', 'conversion', 'boost', 'multiplier'].includes(m.kind)).map(m => {
        const source = current.value.stats.sources.find(s => s.modifiers.some(value => value.id === m.id))?.label ??
          content.folds.find(f => m.id.startsWith('fold/' + f.id + '/'))?.name ?? action.name
        return <li key={m.id}><small>{source}</small><b>{modifier(m)}</b></li>
      })}</ul>
      <hr/><small>Applied folds</small><p>{installed.map(words).join(', ') || 'Unfolded'}</p></> :
    fold ? <><p>{words(fold.handle)} handle · {words(fold.compatibility)}</p>
      <div className="counters">{tension <= 3 && <div><b>{tension} / 3</b><small>Tension</small></div>}<div><b>{ids.length} / 2</b><small>Folds</small></div></div>
      <ul className="fold-effects" aria-label={removing ? 'Effects to remove' : 'Fold effects'}>{effects(fold).map(t => <li key={t}>{t}</li>)}</ul>
      {legal ? <p className="fold-hint">Drag {words(fold.handle)} to trace the pattern.</p> :
        <div className="notice warning"><strong>Cannot apply fold</strong>
          {tension > 3 && <p>Would use {tension} of 3 tension</p>}<p>
          {(proposal.ok ? words(proposal.value.result.reason) : words(proposal.reason)) + ' · ' +
            (tension > 3 ? 'Remove a fold to free tension.' : 'Choose a compatible pattern at rest.')}</p></div>}
      <div className="fold-decision">{legal && <><small>{removing ? 'If unfolded' : 'Compatible · If applied'}</small>
        <dl>{tradeoff.map(({ label, from, to, unit }) => <div key={label}><dt>{label}</dt>
          <dd>{from !== to && num(from) + ' → '}{num(to)}{unit}</dd></div>)}</dl></>}
      <button className="primary" disabled={!legal} onClick={() => {
        const r = api.character.setFolds(id, ids); report(r.accepted ? action.name + (removing ? ' unfolded' : ' folded') : words(r.reason)); setFold(null)
      }}>Confirm</button></div></> : <p>Select a pattern to preview its footprint, timing and tension.</p>}
    </aside></div>
}
