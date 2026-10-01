'use client'

import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import type { Rect } from './pipeline'

interface SeamProps {
  // The image's rectangle in the canvas's CSS pixels. The seam lives inside it.
  rect: Rect
  // False until the first filtered result is on screen
  active: boolean
  reducedMotion: boolean
  onChange: (position: number) => void
}

const ENTRANCE_MS = 600
const STEP = 0.02

/**
 * The line between the original (left) and the filtered image (right). A
 * slider for assistive technology; dragged with mouse, touch or pen anywhere
 * over the image. On first showing it enters from the right edge and settles
 * at the middle, unless motion is reduced.
 */
export function Seam({ rect, active, reducedMotion, onChange }: SeamProps) {
  const [position, setPosition] = useState(0.5)
  const handle = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const move = (value: number) => {
    const next = Math.min(1, Math.max(0, value))
    setPosition(next)
    onChangeRef.current(next)
  }

  useEffect(() => {
    if (!active) return
    if (reducedMotion) {
      onChangeRef.current(0.5)
      return
    }
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / ENTRANCE_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = 1 - 0.5 * eased
      setPosition(value)
      onChangeRef.current(value)
      if (t < 1 && !dragging.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, reducedMotion])

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = area.current!.getBoundingClientRect()
    move((event.clientX - box.left) / box.width)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    handle.current?.focus({ preventScroll: true })
    fromPointer(event)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? STEP * 5 : STEP
    const target =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? position - step
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? position + step
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 1
              : null
    if (target === null) return
    event.preventDefault()
    dragging.current = true
    move(target)
  }

  const percent = Math.round(position * 100)
  return (
    <div
      ref={area}
      className="image-seam-area"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onPointerDown={onPointerDown}
      onPointerMove={event => event.currentTarget.hasPointerCapture(event.pointerId) && fromPointer(event)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}>
      {active && (
        <div className="image-seam" style={{ left: `${position * 100}%` }}>
          <div
            ref={handle}
            className="image-seam-handle"
            role="slider"
            tabIndex={0}
            aria-label="Seam between original and filtered"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent} percent original`}
            onKeyDown={onKeyDown}>
            <span aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  )
}
