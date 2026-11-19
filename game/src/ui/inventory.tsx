import { useState } from 'react'
import { EQUIPMENT_ROLES, type ItemStore, type RolledItem } from '../sim/core/types'
import { Emblem, modifier, num, words, type FieldProps } from './field'

export function Inventory({ world, character: c, content, api, report }: FieldProps) {
  const [selected, select] = useState(c.inventory[0] ?? c.stash[0] ?? c.equipment.weapon)
  const [discarding, discard] = useState(false)
  const byId = (id: number | null) => c.items.find(i => i.id === id)
  const base = (item: RolledItem) => content.itemBases.find(b => b.id === item.baseId)!
  const item = byId(selected) ?? byId(c.inventory[0] ?? c.equipment.weapon)!
  const equipped = byId(c.equipment[item.role])
  const store: ItemStore | null = c.inventory.includes(item.id) ? 'inventory' : c.stash.includes(item.id) ? 'stash' : null
  const full = c.inventory.length === 30 && c.stash.length === 30
  const editable = world.encounter?.phase === 'rest'
  const preview = store ? api.character.preview({ type: 'equip', itemId: item.id }) : null
  const comparison = preview?.ok ? preview.value : null
  function pick(id: number) { select(id); discard(false) }
  function details(i: RolledItem) {
    const b = base(i)
    return [...Object.entries(b.weaponDamage).filter(([, v]) => v > 0).map(([type, v]) => v + ' base ' + type),
      ...b.modifiers.map(modifier), ...i.affixes.map(roll => {
        const family = content.affixes.find(f => f.id === roll.familyId)!
        return modifier({ ...family.modifier, value: roll.roll * family.valuePerPoint }) + ' · Tier ' + roll.tier
      })]
  }
  return <div className="folio-layout"><div className="paper">
    <h2>Equipped gear</h2><div className="equipment">{EQUIPMENT_ROLES.map(role => {
      const gear = byId(c.equipment[role])
      return <button key={role} disabled={!gear} aria-pressed={gear?.id === item.id} onClick={() => gear && pick(gear.id)}>
        <Emblem role={role}/><small>{words(role)}</small><b>{gear ? base(gear).name : 'Empty'}</b></button>
    })}</div>
    {(['inventory', 'stash'] as const).map(s => <section className="store" key={s}>
      <div className="section-title"><h2>{words(s)}</h2><span className={c[s].length === 30 ? 'full-count' : undefined}>{c[s].length === 30 && 'Full · '}{c[s].length} / 30</span></div>
      <div className="cells" aria-label={words(s)}>{Array.from({ length: 30 }, (_, n) => {
        const i = byId(c[s][n] ?? null)
        return i ? <button key={n} aria-label={words(s) + ' ' + (n + 1) + ' · ' + base(i).name} aria-pressed={item.id === i.id} onClick={() => pick(i.id)}>
          <Emblem role={i.role}/>{i.affixes.length > 0 && <i className="stitch"/>}</button> : <span key={n} className="cell-empty" aria-label="Empty cell"/>
      })}</div></section>)}</div>
    <aside className="ink"><div className="artifact"><Emblem role={item.role}/></div>
      <small>{words(store ?? 'equipped')} · {words(item.role)} · № {item.id}</small>
      <h2>{base(item).name}</h2><ul>{details(item).map(d => <li key={d}>{d}</li>)}</ul>
      {store && <><hr/><small>Currently equipped</small><h3>{equipped ? base(equipped).name : 'Empty slot'}</h3>
        {equipped && <p>{details(equipped).join(' · ')}</p>}
        {comparison?.result.accepted && <div className="changes">{comparison.actions.some(a => a.before.damage.calculated !== a.after.damage.calculated) &&
            <small>Damage per hit · equipped → selected</small>}
          {comparison.actions.filter(a => a.before.damage.calculated !== a.after.damage.calculated).map(a =>
          <p key={a.skillId}>{words(a.skillId)} <b>{a.before.damage.calculated} → {a.after.damage.calculated}</b></p>)}
          {comparison.delta.maxHealth !== 0 && <p>Health <b>{comparison.before.maxHealth} → {comparison.after.maxHealth}</b></p>}
          {comparison.delta.movementSpeed !== 0 && <p>Speed <b>{num(comparison.before.movementSpeed)} → {num(comparison.after.movementSpeed)} m/s</b></p>}</div>}</>}
      <div className="operations">
        {store && discarding ? <><button className="primary" disabled={!editable} onClick={() => {
          const r = api.character.discard(item.id, store); discard(false); report(r.accepted ? 'Item discarded' : words(r.reason))
        }}>Confirm discard</button><button autoFocus onClick={() => discard(false)}>Keep item</button></> :
        store ? <><button className="primary" disabled={!comparison?.result.accepted} onClick={() => {
          const r = api.character.equip(item.id); report(r.accepted ? 'Equipped ' + base(item).name : words(r.reason))
        }}>Equip {base(item).name}</button>
        {comparison && !comparison.result.accepted && <p>{words(comparison.result.reason)}</p>}
        <button disabled={!editable || c[store === 'inventory' ? 'stash' : 'inventory'].length === 30} onClick={() => {
          const r = api.character.stash(item.id, store); report(r.accepted ? 'Item moved' : words(r.reason))
        }}>{store === 'inventory' ? 'Move to stash' : 'Move to inventory'}</button>
        <button disabled={!editable} onClick={() => discard(true)}>Discard</button>
        {full && <p className="store-warning">Both stores are full. {editable ? 'Discard an item to make room.' : 'Return to the marker to discard an item.'}</p>}</> :
        <button disabled={!editable || item.role === 'weapon' || c.inventory.length === 30} onClick={() => {
          const r = api.character.unequip(item.role); report(r.accepted ? 'Moved to inventory' : words(r.reason))
        }}>Unequip</button>}</div></aside></div>
}
