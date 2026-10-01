'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

export type Signal = 'compiled' | 'interpreted' | 'change'

export interface LedgerRow {
  key: string
  value: ReactNode
  // Teal for the compiled path, amber for JavaScript, pink for a change or failure
  signal?: Signal
}

interface LedgerProps {
  // Four rows at most
  rows: LedgerRow[]
  // 'stage' floats bottom left over the canvas; 'inline' sits in the page flow
  placement?: 'stage' | 'inline'
  label?: string
}

const ANNOUNCE_MS = 1000

const plain = (rows: LedgerRow[]) =>
  rows
    .filter(row => typeof row.value === 'string' || typeof row.value === 'number')
    .map(row => `${row.key} ${row.value}`)
    .join(', ')

/**
 * The readout list: an underlined key and a plain value, the home page's
 * "Profile Stack" pattern. Values update on screen at once; assistive
 * technology hears them at most once a second.
 */
export function Ledger({ rows, placement = 'stage', label = 'Readouts' }: LedgerProps) {
  const text = plain(rows)
  const [announced, setAnnounced] = useState(text)
  const latest = useRef(text)
  const lastAnnounce = useRef(0)

  useEffect(() => {
    latest.current = text
    const wait = Math.max(0, ANNOUNCE_MS - (Date.now() - lastAnnounce.current))
    const timer = setTimeout(() => {
      lastAnnounce.current = Date.now()
      setAnnounced(latest.current)
    }, wait)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <div className={`demo-ledger demo-chrome demo-ledger-${placement}`}>
      <dl aria-label={label}>
        {rows.map(row => (
          <div key={row.key}>
            <dt>{row.key}</dt>
            <dd data-signal={row.signal}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="demo-visually-hidden" aria-live="polite">
        {announced}
      </p>
    </div>
  )
}
