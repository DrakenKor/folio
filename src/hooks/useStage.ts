'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemoShell } from '@/components/demo/DemoShell'

export type StageScale = 1 | 0.75 | 0.5

export interface StageSize {
  // CSS pixels
  cssWidth: number
  cssHeight: number
  // Backing-store pixels: CSS size times the effective ratio
  width: number
  height: number
  // min(devicePixelRatio, cap) times the current scale
  ratio: number
}

export interface StageFrame extends StageSize {
  // Accumulated running time in seconds. Frozen while paused.
  time: number
  // Seconds since the previous frame, clamped to 1/30.
  dt: number
  frame: number
}

export interface StagePointer {
  id: number
  // Stage coordinates in CSS pixels, origin top left
  x: number
  y: number
  // Where this press began
  startX: number
  startY: number
  down: boolean
  type: string
}

export type StageInput =
  | { type: 'down' | 'move' | 'up'; pointer: StagePointer; pointers: StagePointer[]; event: PointerEvent }
  | { type: 'wheel'; x: number; y: number; deltaY: number; event: WheelEvent }
  // Two fingers: scale is the change in their distance since the last event
  | { type: 'pinch'; x: number; y: number; scale: number }

export interface StageOptions {
  onFrame?: (frame: StageFrame) => void
  onResize?: (size: StageSize) => void
  onInput?: (input: StageInput) => void
  onContextLost?: () => void
  onContextRestored?: () => void
  // Upper bound on devicePixelRatio. Default 2.
  ratioCap?: number
  // Run a frame loop. Set false for a stage that only redraws on demand.
  loop?: boolean
  // 'none' for a full stage, 'pan-y' for a visual inside a scrolling page.
  touchAction?: 'none' | 'pan-y'
}

const MAX_POINTERS = 5
const MAX_DT = 1 / 30
const STEP_DOWN_MS = 22
const WINDOW = 60

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

/**
 * Everything a canvas demo needs from its stage: sizing, pixel-ratio policy,
 * the frame loop, pause rules and pointer input. Attach `ref` to the stage
 * element. If that element is a canvas its backing store is sized for you.
 */
export function useStage(options: StageOptions = {}) {
  const shell = useDemoShell()
  const { paused, setReady, reducedMotion } = shell

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const loop = options.loop !== false
  const ratioCap = options.ratioCap ?? 2
  const touchAction = options.touchAction ?? 'none'

  // The element lives in a ref; `attached` re-runs the effects when it changes
  const elementRef = useRef<HTMLElement | null>(null)
  const [attached, setAttached] = useState(0)
  const ref = useCallback((element: HTMLElement | null) => {
    // An inline ref callback is called with null and then the same node on
    // every render, so only a different node counts as a change
    if (!element || element === elementRef.current) return
    elementRef.current = element
    setAttached(count => count + 1)
  }, [])
  const [autoScale, setAutoScale] = useState<StageScale>(1)
  const [manualScale, setManualScale] = useState<StageScale | null>(null)
  const [stats, setStats] = useState({ frameMs: 0, fps: 0 })
  const [size, setSize] = useState<StageSize>({ cssWidth: 0, cssHeight: 0, width: 0, height: 0, ratio: 1 })
  const [contextLost, setContextLost] = useState(false)
  const [visible, setVisible] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)

  const scale = manualScale ?? autoScale
  const running = !paused && visible && tabVisible && !contextLost

  const sizeRef = useRef(size)
  const clock = useRef({ time: 0, frame: 0 })
  const pointers = useRef<StagePointer[]>([])

  const drawFrame = useCallback((dt: number) => {
    const state = clock.current
    state.time += dt
    state.frame += 1
    optionsRef.current.onFrame?.({ ...sizeRef.current, time: state.time, dt, frame: state.frame })
  }, [])

  // One frame without advancing the clock, for redraws while paused
  const redraw = useCallback(() => {
    if (!sizeRef.current.width) return
    optionsRef.current.onFrame?.({ ...sizeRef.current, time: clock.current.time, dt: 0, frame: clock.current.frame })
  }, [])

  // Sizing and pixel ratio
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, ratioCap) * scale
      const next: StageSize = {
        cssWidth: rect.width,
        cssHeight: rect.height,
        width: Math.max(1, Math.round(rect.width * ratio)),
        height: Math.max(1, Math.round(rect.height * ratio)),
        ratio
      }
      const previous = sizeRef.current
      if (previous.width === next.width && previous.height === next.height && previous.ratio === next.ratio) return
      sizeRef.current = next
      if (element instanceof HTMLCanvasElement) {
        element.width = next.width
        element.height = next.height
      }
      setSize(next)
      optionsRef.current.onResize?.(next)
      // Resizing clears a canvas, so repaint what was there
      if (clock.current.frame > 0) redraw()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [attached, ratioCap, scale, redraw])

  // Pause rules: hidden tab, and less than 10% of the stage on screen
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState !== 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      entries => setVisible(entries[entries.length - 1].intersectionRatio >= 0.1),
      { threshold: [0, 0.1] }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [attached])

  // Frame loop
  useEffect(() => {
    if (!elementRef.current || !loop) return
    if (!running) {
      // A stage that starts paused still shows a first frame. Deferred a
      // frame so the caller's own effects have set up what onFrame draws with.
      const paint = requestAnimationFrame(() => {
        if (clock.current.frame === 0) drawFrame(0)
        else redraw()
      })
      return () => cancelAnimationFrame(paint)
    }
    let raf = 0
    let last = 0
    let lastReport = 0
    const intervals: number[] = []
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!last) {
        last = now
        lastReport = now
        drawFrame(0)
        return
      }
      const interval = now - last
      last = now
      drawFrame(Math.min(interval / 1000, MAX_DT))
      intervals.push(interval)
      if (intervals.length > WINDOW) intervals.shift()
      if (intervals.length === WINDOW && median(intervals) > STEP_DOWN_MS) {
        // Steps down, never back up in the same session: no oscillation.
        intervals.length = 0
        setAutoScale(current => (current === 1 ? 0.75 : 0.5))
      }
      if (now - lastReport >= 1000 && intervals.length) {
        lastReport = now
        const frameMs = median(intervals)
        setStats({ frameMs, fps: 1000 / frameMs })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [attached, loop, running, drawFrame, redraw])

  // Pointer input: mouse, touch and pen through pointer events, with capture
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    element.style.touchAction = touchAction
    let pinchDistance = 0

    const locate = (event: PointerEvent | WheelEvent) => {
      const rect = element.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const emit = (input: StageInput) => optionsRef.current.onInput?.(input)
    const downPointers = () => pointers.current.filter(pointer => pointer.down)

    const onDown = (event: PointerEvent) => {
      if (downPointers().length >= MAX_POINTERS) return
      const { x, y } = locate(event)
      const pointer: StagePointer = { id: event.pointerId, x, y, startX: x, startY: y, down: true, type: event.pointerType }
      pointers.current = [...pointers.current.filter(p => p.id !== pointer.id), pointer]
      element.setPointerCapture?.(event.pointerId)
      pinchDistance = 0
      emit({ type: 'down', pointer, pointers: pointers.current, event })
    }
    const onMove = (event: PointerEvent) => {
      const { x, y } = locate(event)
      let pointer = pointers.current.find(p => p.id === event.pointerId)
      if (pointer) {
        pointer.x = x
        pointer.y = y
      } else {
        // A hovering mouse: tracked, never pressed
        pointer = { id: event.pointerId, x, y, startX: x, startY: y, down: false, type: event.pointerType }
        pointers.current = [...pointers.current.filter(p => p.down), pointer]
      }
      emit({ type: 'move', pointer, pointers: pointers.current, event })
      const down = downPointers()
      if (down.length === 2) {
        const distance = Math.hypot(down[0].x - down[1].x, down[0].y - down[1].y)
        if (pinchDistance > 0 && distance > 0) {
          emit({
            type: 'pinch',
            x: (down[0].x + down[1].x) / 2,
            y: (down[0].y + down[1].y) / 2,
            scale: distance / pinchDistance
          })
        }
        pinchDistance = distance
      }
    }
    const onUp = (event: PointerEvent) => {
      const pointer = pointers.current.find(p => p.id === event.pointerId)
      if (!pointer) return
      pointer.down = false
      pinchDistance = 0
      // Touch points vanish on release; a mouse stays as a hover
      pointers.current = pointers.current.filter(p => p.id !== pointer.id || p.type === 'mouse')
      emit({ type: 'up', pointer, pointers: pointers.current, event })
    }
    const onLeave = (event: PointerEvent) => {
      pointers.current = pointers.current.filter(p => p.id !== event.pointerId || p.down)
    }
    const onWheel = (event: WheelEvent) => {
      if (!optionsRef.current.onInput) return
      emit({ type: 'wheel', ...locate(event), deltaY: event.deltaY, event })
    }
    const onLost = (event: Event) => {
      event.preventDefault()
      setContextLost(true)
      optionsRef.current.onContextLost?.()
    }
    const onRestored = () => {
      setContextLost(false)
      optionsRef.current.onContextRestored?.()
    }

    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('pointerleave', onLeave)
    // Not passive, so a stage can preventDefault to zoom instead of scroll
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('webglcontextlost', onLost)
    element.addEventListener('webglcontextrestored', onRestored)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('webglcontextlost', onLost)
      element.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [attached, touchAction])

  return {
    // Attach to the stage element (usually the canvas)
    ref,
    size,
    // Live size, pointers and clock for use inside callbacks without re-rendering
    sizeRef,
    pointers,
    clock,
    // Median time between frames over the last 60, refreshed once a second
    frameMs: stats.frameMs,
    fps: stats.fps,
    scale,
    // null returns to automatic
    setScale: setManualScale,
    autoScale: manualScale === null,
    running,
    paused,
    contextLost,
    reducedMotion,
    redraw,
    // Call when the first real frame is on screen: the threshold backdrop fades
    ready: setReady
  }
}

export type Stage = ReturnType<typeof useStage>
