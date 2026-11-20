import { useState } from 'react'
import { previewBuild, type Loadout, type M3FoldDefinition, type M3World } from '../sim/core'
import type { DrawingPreview } from '../sim/combat/m3/preview'
import { keys, num, words, type FieldProps } from './field'
import { toolNames } from './families'

const conditions = { burden: 'Burden', emberprint: 'Emberprint', draftbind: 'Draftbind' } as const
const ailmentSetup = { burden: 'Fold Dart', emberprint: 'Lay Bed', draftbind: 'Rill Fan' } as const
const phaseNames = ['Windup', 'Active', 'Recovery']

type Path = DrawingPreview['paths'][number]

function pathShape(path: Path, scale: number) {
  const r = path.reach * scale
  const w = Math.max(2, (path.halfWidth || path.radius) * scale)
  if (path.shape === 'disc') return <circle cx={r} r={w}/>
  if (path.shape === 'sector') {
    const angle = path.arcRadians / 2, x = Math.cos(angle) * r, y = Math.sin(angle) * r
    return path.arcRadians >= 2 * Math.PI ? <circle r={r}/> :
      <path d={`M0 0L${x} ${-y} A${r} ${r} 0 ${angle > Math.PI / 2 ? 1 : 0} 1 ${x} ${y}Z`}/>
  }
  return <><path d={`M0 ${-w}H${r}V${w}H0Z`}/>
    {path.shape === 'path' && <path d={`M0 0H${r}m-6 -4l6 4l-6 4`}/>}
    {(path.maxContacts ?? 0) > 1 && <path d={`M${r * .58} -5v10m${r * .24} -10v10`}/>}</>
}

function pathLabel(path: Path) {
  if (path.chargedAt) return 'Full charge ≥ ' + path.chargedAt + ' ticks · auto-release ' + path.autoReleaseAt
  if (path.trigger === 'catch') return 'Answer at striker · only if caught'
  if (path.trigger === 'occupancy') return 'Armed at ' + path.delayTicks + ' ticks · triggers on entry'
  if (path.trigger === 'entry') return 'Catch mark · next new entrant'
  if (path.trigger === 'emberprint') return 'Impression · around printed target'
  if (path.trigger === 'draftbind') return 'Stitch · to a nearby target'
  if (path.startDistance) return 'Reverse stroke · tick ' + path.delayTicks
  return path.role === 'secondary' ? 'Echo · tick ' + path.delayTicks : null
}

function Blueprint({ drawing, label, scale, time }: { drawing: DrawingPreview; label: string; scale: number; time: number }) {
  const { windupTicks, activeTicks, recoveryTicks } = drawing.recipe.timing
  const phases = [windupTicks, activeTicks, recoveryTicks]
  const paths = drawing.paths.filter((p, i, list) => list.findIndex(q =>
    q.shape === p.shape && q.role === p.role && q.angleDegrees === p.angleDegrees &&
    q.lateralOffset === p.lateralOffset && q.trigger === p.trigger) === i)
  const notes = [...new Set(drawing.paths.map(pathLabel).filter(Boolean))]
  const pulses = [...new Set(drawing.paths.filter(p => p.role === 'primary').map(p => p.delayTicks))]
  const primary = paths[0]!
  const targetDistance = primary.reach * .65
  const needsTarget = paths.some(p => p.trigger === 'emberprint' || p.trigger === 'entry' || p.trigger === 'draftbind' || p.trigger === 'catch')
  const centred = primary.shape === 'sector' || primary.shape === 'disc' && primary.reach === 0
  return <section className="m3-plate">
    <h3>{label}</h3>
    <div className="blueprint">
      <svg viewBox="0 0 224 102" role="img" aria-label={label + ' contact paths'}>
        <g transform={`translate(${centred ? 104 : 25} 51)`}>
          <path className="axis" d="M-105 0H200M0 -51V51"/>
          {paths.map((p, i) => <g key={i} className={p.role === 'primary' ? 'draft' : 'trace'}
            transform={`translate(${(p.startDistance ?? (['emberprint', 'entry', 'draftbind'].includes(p.trigger ?? '') ? targetDistance : 0)) * scale} ${(p.lateralOffset ?? 0) * scale}) rotate(${p.angleDegrees ?? 0})`}>
            {pathShape(p, scale)}
          </g>)}
          <circle className="origin" r="3"/>
          {needsTarget && <path className="target-diamond" d="M-4 0L0 -4L4 0L0 4Z" transform={`translate(${(primary.trigger === 'catch' ? primary.reach : targetDistance) * scale} 0)`}/>}
        </g>
      </svg>
    </div>
    <div className="m3-timing" aria-hidden="true">
      {phases.map((ticks, i) => <i key={i} style={{ width: 100 * ticks / time + '%' }}/>)}
      {[...new Set(drawing.paths.map(p => p.delayTicks))].map(tick =>
        <b key={tick} style={{ left: 100 * tick / time + '%' }}/>)}
    </div>
    <div className="m3-phases">{phases.map((ticks, i) => <span key={i}>{phaseNames[i]} <b>{ticks}</b></span>)}</div>
    <div className="m3-path-notes">
      <span>{num(primary.reach || primary.radius)} m {primary.shape === 'disc' && !primary.reach ? 'radius' : 'reach'}
        {primary.maxContacts ? ' · ' + primary.maxContacts + ' / ' + (primary.shape === 'path' ? 'path' : 'lane') : ''}</span>
      {pulses.length > 1 && <span>Pulses at {pulses.join(' · ')} ticks</span>}
      {notes.map(note => <span key={note}>{note}</span>)}
    </div>
  </section>
}

function foldPrice(fold: M3FoldDefinition) {
  const m = fold.mechanic
  const factor = (n: number) => '×' + n.toFixed(2)
  switch (m.kind) {
    case 'splay': return m.angles.join('°, ') + '° · ' + factor(m.primaryFactor) + ' per dart'
    case 'through': return m.maxContacts + ' contacts per path · ' + factor(m.primaryFactor) + ' each'
    case 'after': return factor(m.primaryFactor) + ' now · ' + factor(m.echoFactor) + ' after ' + m.delayTicks + ' ticks'
    case 'hinge': return factor(m.primaryFactor) + ' out · ' + factor(m.returnFactor) + ' on the retrace'
    case 'rim': return num(m.offset) + ' m to each side · ' + factor(m.primaryFactor) + ' per contact'
    case 'catch': return '+' + m.delayTicks + ' ticks at ' + factor(m.primaryFactor) + ' · entrant ' + factor(m.entrantFactor)
  }
}

export function M3Drawings({ props, world, initialSlot }: { props: FieldProps; world: M3World; initialSlot: number | null }) {
  const { character: c, api, report } = props
  const { actions, folds } = world.content.m3
  const [slot, setSlot] = useState(initialSlot ?? 0)
  const [id, setId] = useState(c.loadout[slot] ?? actions[0]!.id)
  const [foldId, setFold] = useState<string | null>(null)
  const [bindings, showBindings] = useState(initialSlot !== null)
  const [tracing, trace] = useState(false)
  const action = actions.find(a => a.id === id)!
  const installed = c.folds[id] ?? []
  const fold = folds.find(f => f.id === foldId)
  const removing = fold && installed.includes(fold.id)
  const ids = fold ? removing ? installed.filter(f => f !== fold.id) : [...installed, fold.id] : installed
  const change = previewBuild(world, { type: 'setFolds', skillId: id, foldIds: ids })
  const result = change.ok ? change.value : null
  const pair = result?.actions.find(a => a.skillId === id)
  const baseQuery = installed.length && world.encounter?.phase === 'rest'
    ? previewBuild(world, { type: 'setFolds', skillId: id, foldIds: [] }) : null
  const base = baseQuery?.ok ? baseQuery.value.actions.find(a => a.skillId === id)?.after : pair?.before
  if (!pair || !base) return <p className="paper">Drawing unavailable.</p>
  const edited = tracing ? base : pair.after
  const locked = (skillId: string) => {
    const card = result?.actions.find(a => a.skillId === skillId)?.before
    return card?.lockedReason ? 'Requires ' + toolNames[card.requiredItem] : null
  }
  const actionName = (skillId: string | null) => actions.find(a => a.id === skillId)?.name ?? 'Empty'
  const editable = world.encounter?.phase === 'rest'
  const legal = result?.result.accepted
  const tension = folds.filter(f => ids.includes(f.id)).reduce((sum, f) => sum + f.tension, 0)
  const select = (skillId: string) => { setId(skillId); setFold(null); trace(false); report('') }
  const selectFold = (pattern: M3FoldDefinition) => { setFold(pattern.id); trace(false); report('') }
  const { condition, payoff, conditionalDamage } = edited
  const damageRow = (from: number[], to: number[]) => {
    const initial = from.join(' · '), final = to.join(' · ')
    return <b>{initial !== final && <span className="damage-base">{initial} <span className="damage-arrow">→</span></span>}<span>{final}</span></b>
  }
  const both = [base, edited]
  const scale = Math.min(...both.flatMap(d => d.paths.map(p => (p.shape === 'sector' || p.shape === 'disc' && p.reach === 0 ? 46 : 141) /
    Math.max(.01, p.reach + (p.shape === 'disc' ? p.radius : 0), Math.abs(p.lateralOffset ?? 0) * 3))))
  const time = Math.max(...both.flatMap(d => [
    d.recipe.timing.windupTicks + d.recipe.timing.activeTicks + d.recipe.timing.recoveryTicks,
    ...d.paths.map(p => p.delayTicks + 1)
  ]))
  function bind(skillId: string | null) {
    const slots: Loadout = [...c.loadout]
    const old = slots.indexOf(skillId)
    if (skillId && old >= 0) slots[old] = slots[slot]!
    slots[slot] = skillId
    const r = api.character.setLoadout(slots)
    report(r.accepted ? keys[slot] + ' · ' + actionName(skillId) : words(r.reason))
  }
  return <div className="m3-editor">
    <nav className="bench-tabs" aria-label="Drawing sections">
      <button aria-pressed={!bindings} onClick={() => showBindings(false)}>Editor</button>
      <button aria-pressed={bindings} onClick={() => showBindings(true)}>Bindings</button>
    </nav>
    {bindings ? <div className="folio-layout">
      <section className="paper"><h2>Choose a slot</h2>
        <div className="binding-slots">{keys.map((key, i) => <button key={key} aria-pressed={i === slot} onClick={() => setSlot(i)}>
          <kbd>{key}</kbd><strong>{actionName(c.loadout[i]!)}</strong>
        </button>)}</div>
      </section>
      <aside className="ink"><small>{editable ? 'Rest bindings' : 'Inspection only'}</small><h2>Assign {keys[slot]}</h2>
        <div className="binding-options">
          <button disabled={!editable || c.loadout[slot] === null} onClick={() => bind(null)}>Clear slot</button>
          {actions.map(a => <button key={a.id} disabled={!editable || !!locked(a.id)} aria-pressed={c.loadout[slot] === a.id}
            onClick={() => bind(a.id)}>{a.name}<span>{locked(a.id) ?? keys[c.loadout.indexOf(a.id)] ?? ''}</span></button>)}
        </div>
      </aside>
    </div> : <div className="drawing-layout">
      <div className="action-index"><small>Drawings</small>{actions.map(a => <button key={a.id} aria-label={a.name}
        aria-pressed={id === a.id} onClick={() => select(a.id)}>{a.name}<span>{locked(a.id) ?? keys[c.loadout.indexOf(a.id)] ?? 'Unbound'}</span></button>)}</div>
      <section className="paper drawing-paper">
        <div className="section-title"><div><small>{toolNames[action.familyId]}</small><h2>{action.name}</h2></div>
          {locked(id) && <span className="drawing-lock">{locked(id)}</span>}
        </div>
        <div className="m3-plates">
          <Blueprint drawing={base} label={editable || !installed.length ? 'Base' : 'Committed'} scale={scale} time={time}/>
          <Blueprint drawing={edited} label={fold ? 'Proposed' : 'Folded'} scale={scale} time={time}/>
        </div>
        <small className="tick-caption">Timing in ticks · marks show contacts</small>
        <div className="handle-row">{(['reach', 'spread', 'material'] as const).map(handle => {
          const matching = folds.find(p => p.handle === handle && p.whitelist.includes(id))
          return <button key={handle} data-selected={fold?.handle === handle} disabled={!matching}
            onPointerDown={e => { if (matching && fold === matching) { e.currentTarget.setPointerCapture(e.pointerId); trace(true) } }}
            onPointerMove={e => { if (tracing && (e.movementX || e.movementY)) trace(false) }}
            onLostPointerCapture={() => trace(false)}
            onClick={() => { if (matching) selectFold(matching) }}>{words(handle)}</button>
        })}</div>
        <div className="patterns">{folds.filter(f => f.whitelist.includes(id)).map(f =>
          <button key={f.id} aria-label={f.name} aria-pressed={fold?.id === f.id} onClick={() => selectFold(f)}>
            {f.name}{installed.includes(f.id) && ' ✓'}
          </button>)}</div>
      </section>
      <aside className="ink m3-price">
        <small>Undefended damage per contact</small>
        <div className="contact-values">
          <div><span>Clean</span>{damageRow(base.conditionalDamage.clean, conditionalDamage.clean)}</div>
          {condition && <div><span>With {conditions[condition]}</span>{damageRow(base.conditionalDamage.prepared, conditionalDamage.prepared)}</div>}
        </div>
        {condition && payoff && <p>{ailmentSetup[condition]} sets up {conditions[condition]}. {'rootTicks' in payoff
          ? 'Full charge roots for ' + payoff.rootTicks + ' ticks.' : 'Adds ' + payoff.secondaryDamage + ' damage to a secondary contact.'}</p>}
        <hr/>
        <small>{fold?.name ?? 'Fold price'}</small>
        <div className="counters"><div><b>{tension} / 3</b><small>Tension</small></div>
          <div><b>{ids.length} / 2</b><small>Folds</small></div></div>
        {!!edited.cost.seams && <p>Spends {edited.cost.seams} seams</p>}
        {fold && <><p>{foldPrice(fold)}</p>{!legal && <p>{words(result?.result.reason ?? 'unsupported')}</p>}
          <button className="primary" disabled={!legal} onClick={() => {
            const r = api.character.setFolds(id, ids)
            report(r.accepted ? (removing ? 'Fold removed' : 'Fold applied') : words(r.reason)); setFold(null)
          }}>Confirm</button></>}
      </aside>
    </div>}
  </div>
}
