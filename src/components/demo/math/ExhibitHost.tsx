'use client'

import { KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useDemoShell } from '@/components/demo/DemoShell'
import { StageInput, StagePointer, StageSize, useStage } from '@/hooks/useStage'
import { GalleryManager } from '@/lib/math-visualization/GalleryManager'
import { ExhibitEvent, ExhibitSize, GalleryHost, MathVisualization, Renderer } from '@/types/math-visualization'

// Re-render when the exhibit says its state has changed
export const useExhibit = (exhibit: MathVisualization) =>
  useSyncExternalStore(exhibit.subscribe, exhibit.getVersion, exhibit.getVersion)

const FADE_MS = 240
const TOP = 108
const RAIL = 368

export interface Corner {
  width: number
  height: number
}

// The part of the stage the chrome leaves clear: under the tabs and beside
// the rail, with the placard block in its bottom left corner
const fit = (size: StageSize, corner: Corner): ExhibitSize => {
  const phone = size.cssWidth < 768
  const gutter = phone ? 16 : 24
  return {
    width: size.cssWidth,
    height: size.cssHeight,
    ratio: size.ratio,
    safe: { top: TOP, left: gutter, right: phone ? gutter : RAIL, bottom: phone ? 12 : 24 },
    corner
  }
}

const translate = (input: StageInput, pointers: StagePointer[]): ExhibitEvent => {
  const touches = pointers.filter(pointer => pointer.down).length
  if (input.type === 'wheel') {
    return { type: 'wheel', x: input.x, y: input.y, pressed: touches > 0, deltaY: input.deltaY, pinch: input.event.ctrlKey }
  }
  if (input.type === 'pinch') return { type: 'pinch', x: input.x, y: input.y, pressed: true, scale: input.scale }
  const { pointer, event } = input
  return {
    type: input.type,
    x: pointer.x,
    y: pointer.y,
    pressed: pointer.down,
    pointerType: pointer.type,
    shift: event.shiftKey,
    touches
  }
}

interface ExhibitHostProps {
  manager: GalleryManager
  exhibit: MathVisualization
  // Size of the placard and ledger block, which the exhibit keeps clear of
  corner: Corner
}

/**
 * The stage every exhibit plays on. One canvas of each kind stays mounted and
 * the one in use is shown; pointer, wheel, pinch and key input reach the
 * exhibit as typed events in stage coordinates.
 */
export function ExhibitHost({ manager, exhibit, corner: cornerSize }: ExhibitHostProps) {
  const { paused, setPaused, reducedMotion } = useDemoShell()
  const glCanvas = useRef<HTMLCanvasElement | null>(null)
  const flatCanvas = useRef<HTMLCanvasElement | null>(null)
  const ghost = useRef<HTMLCanvasElement | null>(null)
  const corner = useRef(cornerSize)
  const host = useRef<GalleryHost | null>(null)
  const announced = useRef(false)
  const [shown, setShown] = useState<Renderer | null>(null)
  useExhibit(exhibit)

  const stage = useStage({
    onResize: size => {
      for (const canvas of [glCanvas.current, flatCanvas.current]) {
        if (!canvas) continue
        canvas.width = size.width
        canvas.height = size.height
      }
      manager.active?.resize(fit(size, corner.current))
    },
    onFrame: ({ dt }) => {
      const active = manager.active
      if (!active?.ready) return
      active.update(dt)
      if (announced.current) return
      announced.current = true
      stage.ready()
    },
    onInput: input => {
      const active = manager.active
      if (!active?.ready) return
      const used = active.handleInteraction(translate(input, stage.pointers.current))
      // Only an exhibit that zooms keeps the wheel from scrolling the page
      if (used && input.type === 'wheel') input.event.preventDefault()
      if (!stage.running) stage.redraw()
    }
  })
  const { redraw, sizeRef, running } = stage

  // The shell's pause, mirrored so labels can follow it
  useEffect(() => {
    exhibit.setPaused(paused)
  }, [exhibit, paused])

  // Bring the chosen exhibit on stage. The one being left fades out over the
  // one arriving.
  useEffect(() => {
    if (!glCanvas.current || !flatCanvas.current) return
    const canvases: GalleryHost['canvases'] = { webgl2: glCanvas.current, '2d': flatCanvas.current }
    let cancelled = false

    const leaving = manager.active
    const copy = ghost.current
    if (leaving?.ready && leaving !== exhibit && copy && !reducedMotion) {
      const source = canvases[leaving.renderer]
      const context = copy.getContext('2d')
      if (context && source.width) {
        // A fresh frame, so a WebGL buffer can still be read
        leaving.update(0)
        copy.width = source.width
        copy.height = source.height
        context.drawImage(source, 0, 0)
        copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease' })
      }
    }

    host.current = { canvases, reducedMotion, setPaused }
    manager.activate(exhibit.id, host.current).then(active => {
      if (cancelled) return
      active.resize(fit(sizeRef.current, corner.current))
      setShown(active.renderer)
      redraw()
    })
    return () => {
      cancelled = true
    }
  }, [manager, exhibit, reducedMotion, setPaused, redraw, sizeRef])

  useEffect(() => () => manager.cleanup(), [manager])

  // The placard changed height: the exhibit lays itself out again
  useEffect(() => {
    corner.current = cornerSize
    manager.active?.resize(fit(sizeRef.current, cornerSize))
    redraw()
  }, [cornerSize, manager, redraw, sizeRef])

  // While the stage is paused, a change of state still repaints it
  useEffect(() => (running ? undefined : exhibit.subscribe(redraw)), [exhibit, running, redraw])

  // A lost WebGL context comes back with nothing in it: set the exhibit up again
  useEffect(() => {
    const canvas = glCanvas.current
    if (!canvas) return
    const onLost = (event: Event) => event.preventDefault()
    const onRestored = () => {
      const active = manager.active
      if (!active || active.renderer !== 'webgl2' || !host.current) return
      manager.cleanup()
      manager.activate(active.id, host.current).then(restored => {
        restored.resize(fit(sizeRef.current, corner.current))
        redraw()
      })
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [manager, redraw, sizeRef])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return
    const active = manager.active
    if (!active?.ready) return
    const { cssWidth, cssHeight } = sizeRef.current
    if (!active.handleInteraction({ type: 'key', key: event.key, x: cssWidth / 2, y: cssHeight / 2, pressed: false })) return
    event.preventDefault()
    if (!running) redraw()
  }

  // Read-only state, for checks that need more than the ledger shows
  const data = Object.fromEntries(Object.entries(exhibit.getData()).map(([key, value]) => [`data-${key}`, value]))

  return (
    <div
      ref={node => stage.ref(node)}
      id="math-stage"
      className="demo-canvas math-stage"
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={`math-tab-${exhibit.id}`}
      aria-describedby="math-description"
      onKeyDown={onKeyDown}
      data-exhibit={exhibit.id}
      data-frame-ms={stage.frameMs.toFixed(1)}
      {...data}>
      {(['webgl2', '2d'] as const).map(kind => (
        <canvas
          key={kind}
          ref={kind === 'webgl2' ? glCanvas : flatCanvas}
          className="math-canvas"
          data-kind={kind}
          data-shown={shown === kind ? 'true' : 'false'}
          role="img"
          aria-label={exhibit.description}
          aria-hidden={shown !== kind}
        />
      ))}
      <canvas ref={ghost} className="math-ghost" aria-hidden="true" />
    </div>
  )
}
