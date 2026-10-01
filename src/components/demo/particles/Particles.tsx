'use client'

import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Poster, Stage, useDemoShell, useShortcut } from '@/components/demo/DemoShell'
import { Ledger } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Rail, useIsPhone } from '@/components/demo/Rail'
import { Actions, Button, Segmented, Select, Slider } from '@/components/demo/controls'
import { useStage } from '@/hooks/useStage'
import { Palette, Rgb, Simulation, createSimulation, liveBuffers } from './simulation'
import { Homes, Shape, buildHomes } from './shapes'
import './particles.css'

const TEMP_DEBUG = true // TEMP
const TIERS = [16384, 65536, 262144, 1048576]
const PHONE_TIER = 1
const DESKTOP_TIER = 2
// Seconds the points drift before the springs switch on
const ENTRANCE = 1.5
const ENTRANCE_FLOW = 6
const SCATTER = 2.5
const STEP_DOWN_MS = 22

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'name', label: 'Name' },
  { value: 'galaxy', label: 'Galaxy' },
  { value: 'lattice', label: 'Lattice' },
  { value: 'none', label: 'None' }
]

// On wide stages the rail takes the right side, so the shape sits left of centre
const layoutFor = (halfWidth: number, cssWidth: number, cssHeight: number) => {
  const aspect = cssWidth / cssHeight
  const wide = cssWidth >= 768
  return {
    fit: Math.min(0.72, (aspect * (wide ? 0.62 : 0.9)) / halfWidth),
    center: [wide ? -0.22 * aspect : 0, 0] as [number, number]
  }
}

const token = (element: Element, name: string): Rgb => {
  const hex = getComputedStyle(element).getPropertyValue(name).trim().replace('#', '')
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb
}

export function Particles() {
  const { reducedMotion } = useDemoShell()
  const phone = useIsPhone()
  const [shape, setShape] = useState<Shape>('portrait')
  const [chosenTier, setChosenTier] = useState<number | null>(null)
  const [halved, setHalved] = useState(false)
  const [flow, setFlow] = useState(0.4)
  const [spring, setSpring] = useState(1)
  const [drag, setDrag] = useState(1.5)
  const [pointer, setPointer] = useState<'push' | 'pull' | 'off'>('push')
  const [reach, setReach] = useState(0.18)
  const [size, setSize] = useState(1.2)
  const [palette, setPalette] = useState<Palette>('bone')
  const [unsupported, setUnsupported] = useState(false)
  // Bumped when the graphics context comes back, to build everything again
  const [generation, setGeneration] = useState(0)

  const tier = chosenTier ?? (phone ? PHONE_TIER : DESKTOP_TIER)
  const count = halved ? TIERS[tier] / 2 : TIERS[tier]

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const simRef = useRef<Simulation | null>(null)
  const homesRef = useRef<Homes | null>(null)
  const colorsRef = useRef<Record<'bone' | 'teal' | 'amber' | 'pink', Rgb> | null>(null)
  const readyAt = useRef<number | null>(null)
  const scatterRef = useRef(false)
  // The keyboard's stand-in for a pointer, in CSS pixels
  const virtual = useRef({ x: 0, y: 0, on: false })
  const params = useRef({ shape, flow, spring, drag, pointer, reach, size, palette })
  useEffect(() => {
    params.current = { shape, flow, spring, drag, pointer, reach, size, palette }
  })

  const stage = useStage({
    onFrame: ({ time, dt, width, height, cssWidth, cssHeight, ratio }) => {
      const sim = simRef.current
      const gl = glRef.current
      const colors = colorsRef.current
      if (!sim || !gl || !colors || !width) return
      const p = params.current
      const aspect = cssWidth / cssHeight
      const { fit, center } = layoutFor(homesRef.current?.halfWidth ?? 1, cssWidth, cssHeight)
      const toUnits = (x: number, y: number): [number, number] => [
        (x - cssWidth / 2) / (cssHeight / 2),
        -(y - cssHeight / 2) / (cssHeight / 2)
      ]

      const pointers = stage.pointers.current.map(item => toUnits(item.x, item.y))
      if (virtual.current.on) pointers.push(toUnits(virtual.current.x, virtual.current.y))
      const springOn = reducedMotion || (readyAt.current !== null && time - readyAt.current >= ENTRANCE)

      gl.viewport(0, 0, width, height)
      if (dt > 0) {
        sim.step({
          dt,
          time,
          spring: p.shape === 'none' || !springOn ? 0 : p.spring,
          flow: springOn ? p.flow : ENTRANCE_FLOW,
          drag: p.drag,
          reach: p.reach * 2,
          pointerSign: p.pointer === 'push' ? 1 : p.pointer === 'pull' ? -1 : 0,
          fit,
          center,
          aspect,
          pointers: pointers.flat(),
          scatter: scatterRef.current ? SCATTER : 0,
          scatterCenter: pointers[0] ?? [0, 0]
        })
        scatterRef.current = false
      }
      sim.render({ aspect, size: p.size * ratio, palette: p.palette, ...colors })

      // The first frame is held back until the homes exist, so the portrait
      // never shows half formed under reduced motion
      if (readyAt.current === null && (homesRef.current || p.shape === 'none')) {
        readyAt.current = time
        stage.ready()
      }
    },
    onContextRestored: () => setGeneration(current => current + 1)
  })

  // The context and the simulation. Rebuilt when the context is restored.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let gl: WebGL2RenderingContext | null = null
    let sim: Simulation | null = null
    try {
      if (TEMP_DEBUG && location.search.includes('nogl')) throw new Error('forced') // TEMP
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
      if (!gl) throw new Error('no webgl2')
      sim = createSimulation(gl)
    } catch {
      const timer = setTimeout(() => setUnsupported(true))
      return () => clearTimeout(timer)
    }
    glRef.current = gl
    simRef.current = sim
    colorsRef.current = {
      bone: token(canvas, '--demo-bone'),
      teal: token(canvas, '--signal-compiled'),
      amber: token(canvas, '--signal-interpreted'),
      pink: token(canvas, '--signal-change')
    }
    return () => {
      sim.dispose()
      simRef.current = null
    }
  }, [generation])

  // One pair of state buffers per count: the old pair is deleted first
  useEffect(() => {
    simRef.current?.setCount(count)
  }, [count, generation])

  // Homes for the shape and count. Positions are left alone, so the springs
  // turn the change into a morph; under reduced motion it cuts instead.
  useEffect(() => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas || !sim) return
    let cancelled = false
    const family = getComputedStyle(canvas).getPropertyValue('--font-demo-title')
    buildHomes(shape, count, family).then(result => {
      if (cancelled || !result) return
      homesRef.current = result
      sim.setHomes(result.homes)
      if (reducedMotion) {
        const { cssWidth, cssHeight } = stage.sizeRef.current
        const { fit, center } = layoutFor(result.halfWidth, cssWidth, cssHeight)
        sim.cut(result.homes, fit, center)
      }
      stage.redraw()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, count, generation, reducedMotion])

  // Past 22 ms a frame at half resolution, there is nothing left to give up but points
  if (!halved && stage.scale === 0.5 && stage.frameMs > STEP_DOWN_MS) setHalved(true)

  const scatter = () => {
    scatterRef.current = true
    stage.redraw()
  }
  useShortcut('s', 'Scatter the points', scatter)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !TEMP_DEBUG) return
    const handle = {
      sim: () => simRef.current,
      gl: () => glRef.current,
      homes: () => homesRef.current,
      stage,
      liveBuffers,
      setVirtual: (x: number, y: number, on = true) => Object.assign(virtual.current, { x, y, on }),
      // Reads the first `n` points back from the buffer holding the latest state
      read: (n: number) => {
        const gl = glRef.current!
        const out = new Float32Array(n * 4)
        // Through a scratch copy: reading the feedback buffer directly can return a stale cache
        const copy = gl.createBuffer()
        gl.bindBuffer(gl.COPY_READ_BUFFER, simRef.current!.buffers()[0])
        gl.bindBuffer(gl.COPY_WRITE_BUFFER, copy)
        gl.bufferData(gl.COPY_WRITE_BUFFER, out.byteLength, gl.STREAM_READ)
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, out.byteLength)
        gl.getBufferSubData(gl.COPY_WRITE_BUFFER, 0, out)
        gl.deleteBuffer(copy)
        return Array.from(out)
      }
    }
    ;(window as unknown as { __particles?: unknown }).__particles = handle
  })

  const moveVirtual = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const { cssWidth, cssHeight } = stage.sizeRef.current
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }
    const step = cssHeight * (event.shiftKey ? 0.1 : 0.04)
    const move = arrows[event.key]
    if (move) {
      event.preventDefault()
      const v = virtual.current
      if (!v.on) Object.assign(v, { x: cssWidth / 2, y: cssHeight / 2, on: true })
      v.x = Math.min(cssWidth, Math.max(0, v.x + move[0] * step))
      v.y = Math.min(cssHeight, Math.max(0, v.y + move[1] * step))
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${v.x}px, ${v.y}px)`
        cursorRef.current.dataset.on = 'true'
      }
      stage.redraw()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      scatter()
    }
  }
  const dropVirtual = () => {
    virtual.current.on = false
    if (cursorRef.current) cursorRef.current.dataset.on = 'false'
  }

  if (unsupported) {
    return (
      <Stage pausable={false}>
        <Poster>This demo needs WebGL 2, which this browser or device does not provide.</Poster>
      </Stage>
    )
  }

  const { width, height, ratio } = stage.size
  const live = count.toLocaleString()

  return (
    <>
      <Stage>
        <canvas
          ref={node => {
            canvasRef.current = node
            stage.ref(node)
          }}
          className="demo-canvas particles-canvas"
          tabIndex={0}
          aria-label="Particles forming a portrait. Decorative simulation."
          onKeyDown={moveVirtual}
          onBlur={dropVirtual}
          onPointerDown={dropVirtual}
        />
        <div ref={cursorRef} className="particles-cursor" data-on="false" aria-hidden="true" />
        {stage.contextLost && (
          <div className="particles-lost" role="alert">
            <p>The graphics context was lost</p>
            <Button
              variant="primary"
              onClick={() => {
                const lose = glRef.current?.getExtension('WEBGL_lose_context')
                if (lose) lose.restoreContext()
                else window.location.reload()
              }}>
              Restart
            </Button>
          </div>
        )}
        <Rail>
          <Select label="Shape" value={shape} options={SHAPES} onChange={setShape} />
          <Slider
            label="Count"
            value={tier}
            min={0}
            max={TIERS.length - 1}
            defaultValue={phone ? PHONE_TIER : DESKTOP_TIER}
            format={value => TIERS[value].toLocaleString()}
            onChange={value => {
              setChosenTier(value)
              setHalved(false)
            }}
          />
          <p className="particles-hint">{TIERS[3].toLocaleString()} needs a strong GPU.</p>
          <Slider label="Flow" value={flow} min={0} max={2} step={0.01} defaultValue={0.4} onChange={setFlow} />
          <Slider label="Spring" value={spring} min={0} max={4} step={0.01} defaultValue={1} onChange={setSpring} />
          <Slider label="Drag" value={drag} min={0} max={5} step={0.01} defaultValue={1.5} onChange={setDrag} />
          <Segmented
            label="Pointer"
            value={pointer}
            onChange={setPointer}
            options={[
              { value: 'push', label: 'Push' },
              { value: 'pull', label: 'Pull' },
              { value: 'off', label: 'Off' }
            ]}
          />
          <Slider label="Reach" value={reach} min={0.05} max={0.5} step={0.01} defaultValue={0.18} onChange={setReach} />
          <Slider label="Point size" value={size} min={0.5} max={4} step={0.1} defaultValue={1.2} onChange={setSize} />
          <Segmented
            label="Palette"
            value={palette}
            onChange={setPalette}
            options={[
              { value: 'bone', label: 'Bone' },
              { value: 'velocity', label: 'Velocity' },
              { value: 'spectrum', label: 'Spectrum' }
            ]}
          />
          <Actions>
            <Button variant="primary" onClick={scatter}>
              Scatter
            </Button>
          </Actions>
        </Rail>
        <Ledger
          rows={[
            halved
              ? { key: 'Particles', value: `${live}, halved to keep up`, signal: 'change' }
              : { key: 'Particles', value: live },
            { key: 'Frame', value: `${stage.frameMs.toFixed(1)} ms` },
            { key: 'Engine', value: 'GPU, transform feedback', signal: 'compiled' },
            { key: 'Resolution', value: `${width} x ${height} at ${Number(ratio.toFixed(2))}x` }
          ]}
        />
      </Stage>
      <Notes slug="particles">
        <NotesSection title="What you are looking at">
          <p>
            {live} points. Each has a position and a velocity stored on your graphics card, and each has a home it is
            pulled toward. Move your pointer through them. With the keyboard, focus the canvas, move the pointer with
            the arrow keys and press Enter to scatter.
          </p>
        </NotesSection>
        <NotesSection title="How it works">
          <p>
            Four forces act on every point. A spring pulls it toward its home. A flow field pushes it along the curl
            of simplex noise, which has no sources or sinks, so points do not clump. Your pointer, or up to five
            fingers, pushes or pulls any point within Reach. Drag slows whatever is moving.
          </p>
          <p>
            The update runs in a vertex shader and writes straight back to a buffer, so JavaScript never sees the
            positions. Two buffers swap each frame, and the points are drawn from whichever was written last.
          </p>
          <p>
            The portrait is public/profile.svg drawn to an offscreen canvas at twice its size. Each point picks one of
            the light pixels at random as its home. The name is drawn the same way in Inter 800 small caps. Galaxy
            and Lattice are generated from formulas, and None gives the points no home.
          </p>
        </NotesSection>
        <NotesSource
          files={[
            'src/components/demo/particles/Particles.tsx',
            'src/components/demo/particles/simulation.ts',
            'src/components/demo/particles/shapes.ts',
            'src/shaders/particles-update.glsl',
            'src/shaders/particles-draw.glsl'
          ]}
        />
      </Notes>
    </>
  )
}
