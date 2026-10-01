import { KeyboardEvent, PointerEvent, RefObject, useRef } from 'react'
import { TimelinePositionCalculator } from '@/lib/timeline-position-calculator'
import type { TimelineRole } from './RoleArticle'

interface YearRailProps {
  roles: TimelineRole[]
  calc: TimelinePositionCalculator
  active: number
  // One entry per role while a technology is chosen, otherwise null
  matches: boolean[] | null
  onSeek: (ms: number, smooth: boolean) => void
  // The page sets --timeline-p and data-over on this element as it scrolls
  railRef: RefObject<HTMLDivElement | null>
}

/**
 * A vertical scrubber from the first year to today with a diamond per role.
 * Click or drag to jump; the arrow keys step between roles.
 */
export function YearRail({ roles, calc, active, matches, onSeek, railRef }: YearRailProps) {
  const track = useRef<HTMLDivElement | null>(null)
  const role = roles[active]

  const seekAt = (event: PointerEvent, smooth: boolean) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || box.height === 0) return
    let fraction = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))
    // Land on a diamond when the pointer is within 12 px of one, so a click chooses that role
    const near = roles.map(item => calc.paramAtDate(item.start)).find(t => Math.abs(t - fraction) * box.height < 12)
    if (near !== undefined) fraction = near
    onSeek(calc.start.getTime() + fraction * (calc.end.getTime() - calc.start.getTime()), smooth)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const next = { ArrowDown: active + 1, ArrowRight: active + 1, ArrowUp: active - 1, ArrowLeft: active - 1, Home: 0, End: roles.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onSeek(roles[Math.max(0, Math.min(roles.length - 1, next))].start.getTime(), true)
  }

  return (
    <div
      ref={railRef}
      className="timeline-rail demo-chrome"
      role="slider"
      tabIndex={0}
      aria-label="Year"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={roles.length - 1}
      aria-valuenow={active}
      aria-valuetext={`${role.company}, ${role.start.getUTCFullYear()}`}
      onKeyDown={onKeyDown}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId)
        seekAt(event, true)
      }}
      onPointerMove={event => {
        if (event.buttons) seekAt(event, false)
      }}>
      <span className="timeline-rail-year" data-end="start">
        {calc.start.getUTCFullYear()}
      </span>
      <div ref={track} className="timeline-rail-track">
        <span className="timeline-rail-fill" />
        {roles.map((item, index) => (
          <span
            key={item.id}
            className="timeline-rail-diamond"
            data-active={index === active ? 'true' : 'false'}
            data-match={matches ? String(matches[index]) : undefined}
            style={{ top: `${calc.paramAtDate(item.start) * 100}%` }}
          />
        ))}
      </div>
      <span className="timeline-rail-year" data-end="end">
        {calc.end.getUTCFullYear()}
      </span>
    </div>
  )
}
