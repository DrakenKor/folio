'use client'

import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useId, useRef, useState } from 'react'

export interface RailTab {
  id: string
  label: string
  content: ReactNode
}

interface RailProps {
  // Names the panel for assistive technology and labels the collapsed tab
  label?: string
  children?: ReactNode
  // More than one panel in the same rail. On phones these are the sheet's tabs.
  tabs?: RailTab[]
}

type SheetStop = 'rest' | 'half' | 'full'

const PHONE_QUERY = '(max-width: 767px)'
const SHEET_REST = 96
const BAR = 56

// True under 768 px, where the rail is a bottom sheet
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

const stopHeight = (stop: SheetStop) => {
  if (stop === 'rest') return SHEET_REST
  if (stop === 'half') return window.innerHeight / 2
  return window.innerHeight - BAR
}

/**
 * The floating control panel. On desktop it collapses to a tab that never
 * disappears. Under 768 px it is a bottom sheet that rests at 96 px and drags
 * to half and full height.
 */
export function Rail({ label = 'Controls', children, tabs }: RailProps) {
  const phone = useIsPhone()
  const panelId = useId()
  const [collapsed, setCollapsed] = useState(false)
  const [stop, setStop] = useState<SheetStop>('rest')
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id)
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  const active = tabs?.find(tab => tab.id === activeTab) ?? tabs?.[0]
  const body = active ? active.content : children

  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startHeight: stopHeight(stop), moved: false }
  }
  const onHandleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const delta = drag.current.startY - event.clientY
    if (Math.abs(delta) > 4) drag.current.moved = true
    const height = Math.min(stopHeight('full'), Math.max(SHEET_REST, drag.current.startHeight + delta))
    setDragHeight(height)
  }
  const onHandleUp = () => {
    const state = drag.current
    drag.current = null
    if (!state) return
    if (!state.moved) {
      // A tap, or Enter and Space, steps through the three stops
      setStop(current => (current === 'rest' ? 'half' : current === 'half' ? 'full' : 'rest'))
    } else if (dragHeight !== null) {
      const stops: SheetStop[] = ['rest', 'half', 'full']
      setStop(
        stops.reduce((best, candidate) =>
          Math.abs(stopHeight(candidate) - dragHeight) < Math.abs(stopHeight(best) - dragHeight) ? candidate : best
        )
      )
    }
    setDragHeight(null)
  }

  const tablist = tabs && tabs.length > 1 && (
    <div className="demo-rail-tabs" role="tablist" aria-label={label}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active?.id}
          className="demo-rail-tab"
          onClick={() => {
            setActiveTab(tab.id)
            if (phone && stop === 'rest') setStop('half')
          }}>
          {tab.label}
        </button>
      ))}
    </div>
  )

  if (phone) {
    return (
      <aside
        className="demo-rail demo-sheet demo-chrome"
        aria-label={label}
        data-stop={stop}
        data-dragging={dragHeight !== null ? 'true' : 'false'}
        style={dragHeight !== null ? { height: dragHeight } : undefined}>
        <button
          type="button"
          className="demo-sheet-handle"
          aria-expanded={stop !== 'rest'}
          aria-controls={panelId}
          aria-label={stop === 'full' ? `Lower ${label.toLowerCase()}` : `Raise ${label.toLowerCase()}`}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setStop(current => (current === 'rest' ? 'half' : current === 'half' ? 'full' : 'rest'))
            }
          }}>
          <span aria-hidden="true" />
        </button>
        {tablist}
        <div className="demo-rail-body" id={panelId}>
          {body}
        </div>
      </aside>
    )
  }

  return (
    <aside className="demo-rail demo-chrome" aria-label={label} data-collapsed={collapsed ? 'true' : 'false'}>
      <button
        type="button"
        className="demo-rail-toggle"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={() => setCollapsed(value => !value)}>
        <span>{label}</span>
        <span className="demo-rail-toggle-state">{collapsed ? 'Show' : 'Hide'}</span>
      </button>
      {!collapsed && tablist}
      <div className="demo-rail-body" id={panelId} hidden={collapsed}>
        {body}
      </div>
    </aside>
  )
}
