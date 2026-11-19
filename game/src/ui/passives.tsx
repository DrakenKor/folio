import { useMemo, useRef, useState } from 'react'
import { inspectStats, previewBuild, type Operation } from '../sim/core'
import { graphTopology } from '../sim/progression'
import { modifier, words, type FieldProps } from './field'

const root = '0,0'
const project = (i: number, j: number) => ({ x: (i + j / 2) * 37, y: j * 32 })
function point(id: string) {
  const [i, j] = id.split(',').map(Number)
  return project(i!, j!)
}

export function Passives({ world, character, content, api, report }: FieldProps) {
  const topology = useMemo(() => graphTopology(world), [world])
  const [selection, select] = useState('1,0')
  const [refund, setRefund] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const labels = useMemo(() => {
    if (!topology.ok) return new Map<string, string>()
    // Ask the stat inspector for every seeded family on a detached display projection.
    const allocations = topology.value.vertices.map(v => v.id).filter(id => id !== root)
    const entities = world.entities.map(e => e.id === world.playerId && e.character ? { ...e,
      character: { ...e.character, graph: { ...e.character.graph, allocations } } } : e)
    const stats = inspectStats({ ...world, entities }, world.playerId!)
    return new Map(stats.ok ? stats.value.sources.map(s => [s.id, s.label]) : [])
  }, [world, topology])
  const shape = topology.ok ? topology.value.shapes.find(s => s.id === selection) : undefined
  const active = character.graph.activeShapes
  const paid = character.graph.allocations.includes(selection)
  const edit = useMemo<Operation>(() => shape ? { type: 'activateShape', shapeId: shape.id, active: !active.includes(shape.id) } :
    { type: paid ? 'refund' : 'allocate', nodeId: selection }, [active, shape, paid, selection])
  const preview = useMemo(() => previewBuild(world, edit), [edit, world])
  if (!topology.ok) return <p>{words(topology.reason)}</p>
  const { vertices, edges, shapes } = topology.value
  const orderedShapes = [...shapes].sort((a, b) => Number(active.includes(a.id)) - Number(active.includes(b.id)))
  const profile = content.graphProfiles.find(p => p.id === character.graph.profileId)!
  const allocated = new Set([root, ...character.graph.allocations])
  const complete = (s: typeof shapes[number]) => s.perimeter.every(id => allocated.has(id))
  const name = (id: string) => id === root ? 'Marker' : labels.get('node/' + id) ?? words(id)
  const bargain = (id: string) => {
    const [kind, n] = id.split('-')
    const b = profile.bargains.find(v => v.orientation === Number(n))!
    return kind === 'rhombus' ? b.rhombus : b.hexagon
  }
  const family = profile.families.find(f => f.name === name(selection))
  const result = preview.ok ? preview.value : null
  const removed = new Set(refund ? result?.refundedNodeIds : [])
  const deactivated = refund ? result?.deactivatedShapeIds ?? [] : []
  const showChange = result?.result.accepted && (edit.type !== 'refund' || refund)
  const hit = showChange ? result.actions.find(a =>
    character.loadout.includes(a.skillId) && a.before.damage.calculated !== a.after.damage.calculated) : undefined
  function pick(id: string, centre = false) {
    select(id); setRefund(false)
    if (centre) {
      const perimeter = shapes.find(s => s.id === id)?.perimeter ?? [id]
      const x = perimeter.reduce((v, n) => v + point(n).x, 0) / perimeter.length
      const y = perimeter.reduce((v, n) => v + point(n).y, 0) / perimeter.length
      setView(v => ({ ...v, x, y })); setSearch('')
    }
  }
  const matches = !search.trim() ? [] : [...vertices.map(v => v.id), ...shapes.map(s => s.id)].filter(id => {
    const tags = shapes.some(s => s.id === id) ? bargain(id).map(modifier).join(' ') : name(id)
    return (name(id) + ' ' + id + ' ' + tags).toLowerCase().includes(search.trim().toLowerCase())
  }).sort((a, b) => {
    const distance = (id: string) => { const p = point(shapes.find(s => s.id === id)?.perimeter[0] ?? id); return Math.hypot(p.x, p.y) }
    return distance(a) - distance(b)
  })
  const zoom = (scale: number) => setView(v => ({ ...v, zoom: Math.max(.65, Math.min(3, v.zoom * scale)) }))
  return <div className="folio-layout"><div className="paper atlas">
    <div className="atlas-tools"><label><span className="sr">Search nodes and shapes</span>
      <input type="search" placeholder="Search name, tag or coordinate" value={search} onInput={e => setSearch(e.currentTarget.value)}/></label>
      <button aria-label="Zoom out" onClick={() => zoom(.8)}>−</button><button aria-label="Zoom in" onClick={() => zoom(1.25)}>+</button>
      <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>Fit</button></div>
    {search.trim() && <div className="search-results">{matches.length ? matches.map(id =>
      <button key={id} onClick={() => pick(id, true)}>{name(id)} · {id}</button>) : 'No matches'}</div>}
    <svg className="lattice" aria-label="Passive graph" viewBox={`${view.x - 300 / view.zoom} ${view.y - 250 / view.zoom} ${600 / view.zoom} ${500 / view.zoom}`}
      onWheel={e => zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12)} onPointerDown={e => {
        if ((e.target as Element).closest('[role=button], polygon')) return
        e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }
      }} onLostPointerCapture={() => { drag.current = null }} onPointerMove={e => {
        if (!drag.current) return
        const unit = e.currentTarget.getScreenCTM()!.a
        const dx = (e.clientX - drag.current.x) / unit, dy = (e.clientY - drag.current.y) / unit
        drag.current = { x: e.clientX, y: e.clientY }; setView(v => ({ ...v, x: v.x - dx, y: v.y - dy }))
      }}>
      {edges.map(([a, b]) => <line key={a + '/' + b} x1={point(a).x} y1={point(a).y} x2={point(b).x} y2={point(b).y}
        className={allocated.has(a) && allocated.has(b) ? 'paid-edge' : ''}/>)}
      {orderedShapes.map(s => <polygon key={s.id} points={s.perimeter.map(id => point(id).x + ',' + point(id).y).join(' ')}
        role="button" tabIndex={0} aria-label={words(s.id)} aria-pressed={selection === s.id}
        className={['boundary', complete(s) && 'complete', active.includes(s.id) && 'active', selection === s.id && 'chosen',
          deactivated.includes(s.id) && 'breaking'].filter(Boolean).join(' ')}
        onClick={() => pick(s.id)} onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(s.id) }
        }}><title>{words(s.id)}</title></polygon>)}
      {edges.filter(([a,b]) => removed.has(a) && removed.has(b)).map(([a,b]) =>
        <line key={a + '/' + b} className="refund-trace" x1={point(a).x} y1={point(a).y} x2={point(b).x} y2={point(b).y}/>)}
      {vertices.map(v => <g key={v.id} role="button" tabIndex={0} aria-label={v.id + ' ' + name(v.id)} aria-pressed={selection === v.id}
        className={['vertex', allocated.has(v.id) && 'paid', removed.has(v.id) && 'removed'].filter(Boolean).join(' ')}
        transform={`translate(${point(v.id).x} ${point(v.id).y})`} onClick={() => pick(v.id)}
        onKeyDown={e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); e.stopPropagation(); pick(v.id) } }}>
        <circle r="11" fill="transparent"/><path d={v.id === root ? 'M0 -9L8 0L0 9L-8 0Z' : 'M0 -4L4 0L0 4L-4 0Z'}/>
        {removed.has(v.id) && <circle className="refund-ring" r="8"/>}
        {selection === v.id && <circle className="ring" r={removed.has(v.id) ? 13 : 10}/>}
        <circle className="focus-ring" r={removed.has(v.id) && selection === v.id ? 17 : 14}/></g>)}</svg>
      <footer className="legend"><span>◇ Marked boundary</span><span>◆ Allocated</span>
        <span><i className="active-swatch" aria-hidden="true"/>Active boundary</span><span>{refund ? 'Red · Refund route' : 'Drag to pan'}</span></footer>
    </div><aside className="ink"><div className="counters"><div><b>{character.points}</b><small>Points left</small></div><div><b>{active.length} / 2</b><small>Active shapes</small></div></div>
      <hr/><small>{shape ? 'Marked perimeter' : 'Vertex · ' + selection}</small><h2>{name(selection)}</h2>
      <ul>{(shape ? bargain(shape.id) : family?.modifiers ?? []).map(m => <li key={m.id}>{modifier(m)}</li>)}</ul>
      <p>{shape ? (active.includes(shape.id) ? 'Active boundary' : complete(shape) ? 'Boundary complete' : 'Incomplete boundary') + ' · ' +
        shape.perimeter.filter(n => allocated.has(n)).length + ' / ' + shape.perimeter.length + ' vertices' : allocated.has(selection) ? 'Allocated' : 'Allocation costs 1 point'}</p>
      {showChange && (hit || result.delta.maxHealth !== 0) && <div className="changes">
        {edit.type === 'activateShape' && <strong>{edit.active ? 'If activated' : 'If deactivated'}</strong>}
        {hit && <><small>Undefended damage per hit</small><p>{content.actions.find(a => a.id === hit.skillId)?.name}
          <b>{hit.before.damage.calculated} → {hit.after.damage.calculated}</b></p></>}
        {result.delta.maxHealth !== 0 && <p>Maximum health <b>{result.before.maxHealth} → {result.after.maxHealth}</b></p>}
      </div>}
      {refund && <div className="notice"><strong>Refund preview</strong><p>Connected removal · {[...removed].join(' / ')}</p>
        {deactivated.length > 0 && <p>Deactivate {deactivated.map(words).join(', ')}</p>}</div>}
      {selection !== root && <div className="operations">{edit.type === 'refund' && !refund ?
        <button className="primary" onClick={() => { setRefund(true); report('') }}>Refund</button> : <button className="primary" disabled={!result?.result.accepted} onClick={() => {
          const r = edit.type === 'activateShape' ? api.character.activateShape(edit.shapeId, edit.active) :
            edit.type === 'refund' ? api.character.refund(selection) : api.character.allocate(selection)
          setRefund(false); report(r.accepted ? 'Lattice updated' : words(r.reason))
        }}>{edit.type === 'activateShape' ? (edit.active ? 'Activate ' : 'Deactivate ') + name(edit.shapeId) :
          refund ? `Refund ${result?.delta.points} ${result?.delta.points === 1 ? 'point' : 'points'}` : 'Confirm'}</button>}{result && !result.result.accepted && <p>{words(result.result.reason)}</p>}</div>}
      <hr/><label className="stack">Inspect a perimeter<select value={shape?.id ?? ''} onChange={e => pick(e.target.value, true)}>
        <option disabled value="">Choose a shape</option>{shapes.map(s => <option key={s.id} value={s.id}>{words(s.id)}{complete(s) ? ' · complete' : ''}</option>)}</select></label>
    </aside></div>
}
