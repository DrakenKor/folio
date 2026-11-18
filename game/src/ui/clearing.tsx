import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { actionPhase, type World } from '../sim/core'
import type { Clock } from '../platform/clock'
import type { Input } from '../platform/input'
import type { SaveController, SaveStatus } from '../platform/saves'
import type { createAPI } from '../debug/api'
import { Inventory } from './inventory'
import { Passives } from './passives'
import { Drawings } from './drawings'
import { Records, locked, recordTitle, type RecordMode } from './records'
import { keys, words } from './field'
import './field.css'

const pages = { Inventory: 'I', Passives: 'P', Drawings: 'K', Save: '' } as const
type Page = keyof typeof pages
const titles: Record<Page, string> = { Inventory: 'Field inventory', Passives: 'Passive lattice', Drawings: 'Action drawings', Save: 'Save & recovery' }
const playKeys = /^(Key[WASDQERTF]|Digit[1-4]|Space)$/
export interface Controls { clock: Clock; input: Input; api: ReturnType<typeof createAPI>; saves: SaveController }

export function Clearing({ clock, input, api, saves, world, status, refresh }: Controls & { world: World; status: SaveStatus; refresh: () => void }) {
  const [page, setPage] = useState<Page | null>(null)
  const [drawingSlot, setDrawingSlot] = useState(0)
  const [mode, setMode] = useState<RecordMode>('status')
  const [notice, report] = useState('')
  const [cleared, setCleared] = useState<number | null>(null)
  const panel = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const previous = useRef(status.code)
  const blocked = locked(status.code)
  const visible = blocked ? 'Save' : page
  const player = world.entities.find(e => e.id === world.playerId)!
  const character = player.character!, content = world.content.m2!
  const open = useCallback((next: Page | null, slot = 0) => {
    input.release()
    clock.suspend('inspection', next !== null)
    if (next === 'Drawings') setDrawingSlot(slot)
    setPage(next); report('')
    if (!next) document.querySelector('canvas')?.focus()
  }, [clock, input])
  useLayoutEffect(() => {
    clock.suspend('save-writer', blocked); input.release()
    return () => { clock.suspend('save-writer', false) }
  }, [blocked, clock, input])
  useLayoutEffect(() => () => { clock.suspend('inspection', false); input.release() }, [clock, input])
  useLayoutEffect(() => {
    if (previous.current !== status.code && !['ready','read-only'].includes(status.code)) {
      setMode('status'); open('Save')
    }
    previous.current = status.code
  }, [open, status.code])
  useLayoutEffect(() => { if (visible) heading.current?.focus() }, [visible])
  useLayoutEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (visible && e.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:enabled,input:enabled,textarea:enabled,select:enabled,[tabindex="0"]') ?? [])
        const first = controls[0], last = controls.at(-1)
        if ((e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) ||
            (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault(); (e.shiftKey ? last : first)?.focus()
        }
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape' && visible && !blocked) { e.preventDefault(); open(null); return }
      if (e.target instanceof Element && e.target.closest('input,textarea,select')) return
      if (visible && playKeys.test(e.code)) {
        if (e.code === 'Space' && e.target instanceof Element && e.target.closest('button,[role=button]')) return
        e.preventDefault(); e.stopPropagation()
        return
      }
      if (e.repeat || blocked) return
      const next = (Object.keys(pages) as Page[]).find(p => 'Key' + pages[p] === e.code)
      if (next) { e.preventDefault(); open(next === visible ? null : next) }
    }
    window.addEventListener('keydown', keyboard, true)
    return () => window.removeEventListener('keydown', keyboard, true)
  }, [blocked, visible, open])
  const props = { world, character, content, api, report }
  const action = player.action
  const phase = action ? actionPhase(action.recipe?.timing ?? world.content.dodge.timing, action.ageTicks) : null
  const goRecord = (next: RecordMode) => { setMode(next); open('Save') }
  const play = () => {
    const count = world.groundDrops.length
    const starting = world.encounter?.phase !== 'defeat'
    const r = starting ? api.character.beginEncounter() : api.character.returnToShelter()
    if (r.accepted) { setCleared(starting ? count : null); report('') }
    else report(words(r.reason))
    document.querySelector('canvas')?.focus()
  }
  return <div className="field-ui">{visible ? <div className="veil"><section ref={panel} className="folio" role="dialog" aria-modal="true" aria-label={titles[visible]}>
    <header className="folio-head"><span className="marker-seal" aria-hidden="true"/><div><small>Windstep clearing · Rank {character.rank}</small><h1 ref={heading} tabIndex={-1}>{titles[visible]}</h1></div>
      <nav>{(Object.keys(pages) as Page[]).map(p => <button key={p} aria-current={visible === p ? 'page' : undefined} disabled={blocked && p !== 'Save'}
        onClick={() => { if (p === 'Save') setMode('status'); open(p) }}>{p}</button>)}</nav>
      {!blocked && <button className="close" aria-label="Close panel" onClick={() => open(null)}>×</button>}</header>
    {visible === 'Inventory' && <Inventory {...props}/>}
    {visible === 'Passives' && <Passives {...props}/>}
    {visible === 'Drawings' && <Drawings {...props} initialSlot={drawingSlot}/>}
    {visible === 'Save' && <Records saves={saves} status={status} mode={mode} change={m => { setPage('Save'); clock.suspend('inspection',true); setMode(m) }} updated={refresh}/>}
    <footer className="folio-foot"><span>{world.encounter?.phase === 'rest' ? 'At the marker' : 'Away from marker · inspection only'}</span>
      <span role="status">{notice}</span><span>{blocked ? 'Waiting for writer access' : 'Paused · Esc to return'}</span></footer></section></div> :
    <><div className="vital-card"><small>Windstep clearing · Rank {character.rank}</small><strong>{player.health} / {player.maxHealth}</strong>
      <div className="hud-health-track"><i style={{ width: player.health / player.maxHealth * 100 + '%' }}/></div>
      <p>{character.xp} XP · {character.points} passive points</p></div>
    <div className="tool-card"><nav>{(['Inventory','Passives','Drawings'] as const).map(p => <button key={p} onClick={() => open(p)}><kbd>{pages[p]}</kbd> {p}</button>)}</nav>
      <button className="save-status" onClick={() => goRecord('status')}>{recordTitle(status.code)}</button>
      <div className="save-links"><button onClick={() => goRecord('export')}>Copy save</button><button onClick={() => goRecord('import')}>Paste save</button><button onClick={() => goRecord('reset')}>Reset</button></div></div>
    <div className="clearing-control">{world.encounter?.phase !== 'active' ? <button className="primary" onClick={play}>{world.encounter?.phase === 'defeat' ? 'Return to marker' :
      'Start clearing · ' + world.groundDrops.length + ' uncollected'}</button> : cleared !== null && <span role="status">{cleared} uncollected {cleared === 1 ? 'drop' : 'drops'} cleared</span>}
      {notice && <p role="status">{notice}</p>}</div>
    <div className="loadout" role="group" aria-label="Inspect action slots">{character.loadout.map((id,i) => {
      const cooldown = id ? player.skillCooldowns[id] ?? 0 : 0
      const state = !id ? 'Empty' : player.death ? 'Fallen' : cooldown ? (cooldown / 60).toFixed(1) + ' s' :
        action?.id === id && phase ? words(phase) : action || player.impactPauseTicks || player.knockback ? 'Waiting' : 'Ready'
      return <button key={i} type="button" data-ready={state === 'Ready'} onClick={() => open('Drawings', i)}>
        <kbd>{keys[i]}</kbd><b>{id ? content.actions.find(a => a.id === id)?.name : 'Unassigned'}</b><span>{state}</span></button>
    })}</div><div className="field-help">WASD move · Mouse aim · Space dodge{player.cooldowns.dodge > 0 && ' (' + (player.cooldowns.dodge / 60).toFixed(1) + ' s)'} · {character.inventory.length === 30 ? 'Inventory full' : 'F collect'}</div></>}
  </div>
}
