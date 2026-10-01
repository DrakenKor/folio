'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Poster, Stage, useDemoShell, useShortcut } from '@/components/demo/DemoShell'
import { Ledger, LedgerRow } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Rail, useIsPhone } from '@/components/demo/Rail'
import { Actions, Button, Segmented, Select, Slider, Toggle } from '@/components/demo/controls'
import { useStage } from '@/hooks/useStage'
import { sourceUrl } from '@/lib/demos'
import { ShaderManager } from '@/lib/shader-management/ShaderManager'
import {
  SHARE_LIMIT,
  ShaderControl,
  ShaderError,
  VERTEX_SHADER,
  decodeShare,
  encodeShare,
  parseControls,
  translateErrors,
  wrapSource
} from '@/lib/shader-source'
import city from '@/shaders/city.glsl'
import constellation from '@/shaders/constellation.glsl'
import fluidDisplay from '@/shaders/fluid-display.glsl'
import helloSphere from '@/shaders/hello-sphere.glsl'
import ink from '@/shaders/ink.glsl'
import mandelbulb from '@/shaders/mandelbulb.glsl'
import waves from '@/shaders/waves.glsl'
import { Editor } from './Editor'
import { FLUID_CONTROL_SOURCE, FluidSim } from './FluidSim'
import './shader.css'

interface Preset {
  id: string
  name: string
  // One line, read out as the canvas's label
  description: string
  source: string
  file: string
}

const PRESETS: Preset[] = [
  {
    id: 'constellation',
    name: 'Constellation',
    description: 'White diamonds drifting up a black field, with thin lines joining the ones that are close.',
    source: constellation,
    file: 'src/shaders/constellation.glsl'
  },
  {
    id: 'hello-sphere',
    name: 'Hello sphere',
    description: 'One sphere with a light circling it. The shortest shader here, and the one to start changing.',
    source: helloSphere,
    file: 'src/shaders/hello-sphere.glsl'
  },
  {
    id: 'mandelbulb',
    name: 'Mandelbulb',
    description: 'A bone-coloured fractal solid with copper in its creases, slowly changing shape. Drag to orbit it.',
    source: mandelbulb,
    file: 'src/shaders/mandelbulb.glsl'
  },
  {
    id: 'city',
    name: 'City',
    description: 'Pale towers on a dark plain, lit from low on one side and fading into haze. Drag to orbit.',
    source: city,
    file: 'src/shaders/city.glsl'
  },
  {
    id: 'waves',
    name: 'Waves',
    description: 'Ripples spreading from three points and crossing. Press to move two of the points.',
    source: waves,
    file: 'src/shaders/waves.glsl'
  },
  {
    id: 'ink',
    name: 'Ink',
    description: 'Marbled ink with a sheen of colour, whirling around the pointer. A drawing of a liquid, not a simulation.',
    source: ink,
    file: 'src/shaders/ink.glsl'
  },
  {
    id: 'fluid',
    name: 'Fluid',
    description: 'Pale dye in a simulated fluid. Move the pointer through it to stir.',
    source: fluidDisplay,
    file: 'src/shaders/fluid-display.glsl'
  }
]

const FLUID = 'fluid'
const PROGRAM = 'main'
const COMPILE_QUIET_MS = 150
const ENTRANCE_MS = 600
// The frame a visitor who asked for less motion starts on, in seconds
const STILL_TIME = 2
// Past this gap a pointer has been away, and its last position says nothing
const TRAIL_MS = 100

type Value = number | boolean | number[]
type Compile = { ok: true; ms: number } | { ok: false; errors: ShaderError[] }

const build = (manager: ShaderManager, source: string): Compile => {
  const started = performance.now()
  try {
    manager.createProgram(PROGRAM, VERTEX_SHADER, wrapSource(source))
    return { ok: true, ms: performance.now() - started }
  } catch (error) {
    return { ok: false, errors: translateErrors(error instanceof Error ? error.message : String(error), source) }
  }
}

// A stored value survives an edit to its annotation only if it still fits
const resolve = (control: ShaderControl, stored: Value | undefined): Value => {
  if (control.kind === 'slider') {
    return typeof stored === 'number' ? Math.min(control.max, Math.max(control.min, stored)) : control.default
  }
  if (control.kind === 'toggle') return typeof stored === 'boolean' ? stored : control.default
  return Array.isArray(stored) ? stored : control.default
}

// dyeFade → "Dye fade"
const labelFor = (name: string) => {
  const words = name.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// About a hundred steps across the range, on a power of ten
const stepFor = (min: number, max: number) => Math.max(0.0001, 10 ** Math.floor(Math.log10((max - min) / 100)))

const toHex = (rgb: number[]) =>
  `#${rgb.map(channel => Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, '0')).join('')}`

const fromHex = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)

const kilobytes = (length: number) => `${(length / 1024).toFixed(1)} KB`

export function ShaderPlayground() {
  const { isReady, paused, setPaused, setBoot, reducedMotion } = useDemoShell()
  const phone = useIsPhone()
  const panelId = useId()
  const hintId = useId()

  // null until the context has been asked for
  const [support, setSupport] = useState<{ webgl2: boolean; fluid: boolean } | null>(null)
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [source, setSource] = useState(PRESETS[0].source)
  // The last source that compiled: the one on the canvas
  const [compiled, setCompiled] = useState(PRESETS[0].source)
  const [compile, setCompile] = useState<Compile | null>(null)
  const [values, setValues] = useState<Record<string, Value>>({})
  const [editorOpen, setEditorOpen] = useState(true)
  // How much of the source the entrance has written, 0 to 1; null once done
  const [typed, setTyped] = useState<number | null>(0)
  const [time, setTime] = useState(0)
  const [note, setNote] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const managerRef = useRef<ShaderManager | null>(null)
  const fluidRef = useRef<FluidSim | null>(null)
  const fluidOn = useRef(false)
  const shown = useRef(false)
  const entered = useRef(false)
  // Shadertoy's iMouse: xy while pressed, zw where the press began
  const mouse = useRef([0, 0, 0, 0])
  const trail = useRef(new Map<number, { x: number; y: number; at: number }>())
  const frameBase = useRef(0)
  const quiet = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const preset = PRESETS.find(item => item.id === presetId) ?? PRESETS[0]
  const isFluid = presetId === FLUID
  const edited = source !== preset.source
  const entering = typed !== null && !reducedMotion
  const errors = compile && !compile.ok ? compile.errors : null

  const controls = useMemo(
    () => parseControls(isFluid ? `${FLUID_CONTROL_SOURCE}\n${compiled}` : compiled),
    [isFluid, compiled]
  )
  const params = useMemo(
    () => Object.fromEntries(controls.map(control => [control.name, resolve(control, values[control.name])])),
    [controls, values]
  )
  const paramsRef = useRef(params)
  const compiledRef = useRef(compiled)

  const stage = useStage({
    onFrame: ({ time: seconds, dt, frame, width, height, cssWidth, cssHeight }) => {
      const gl = glRef.current
      const manager = managerRef.current
      if (!gl || !manager || !manager.hasProgram(PROGRAM)) return
      const fluid = fluidOn.current ? fluidRef.current : null
      if (fluid) {
        fluid.resize(cssWidth, cssHeight)
        if (dt > 0) fluid.step(dt, paramsRef.current)
        fluid.bind()
      }
      const now = new Date()
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      manager.useProgram(PROGRAM)
      manager.setUniforms(PROGRAM, {
        ...paramsRef.current,
        ...(fluid ? { dye: 0, velocity: 1 } : null),
        iResolution: [width, height, 1],
        iTime: seconds,
        iTimeDelta: dt,
        iFrameRate: dt > 0 ? 1 / dt : 60,
        iFrame: frame - frameBase.current,
        iMouse: mouse.current,
        iDate: [
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
        ]
      })
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!shown.current) {
        shown.current = true
        stage.ready()
      }
    },
    onInput: input => {
      if (input.type === 'wheel' || input.type === 'pinch') return
      const { cssWidth, cssHeight, ratio } = stage.sizeRef.current
      const { pointer } = input
      const x = pointer.x * ratio
      const y = (cssHeight - pointer.y) * ratio
      if (input.type === 'down') mouse.current = [x, y, x, y]
      else if (input.type === 'move' && pointer.down) mouse.current = [x, y, mouse.current[2], mouse.current[3]]
      else if (input.type === 'up') {
        const [lastX, lastY, startX, startY] = mouse.current
        mouse.current = [lastX, lastY, -Math.abs(startX), -Math.abs(startY)]
      }

      // The fluid is stirred by any movement, pressed or not
      const fluid = fluidOn.current ? fluidRef.current : null
      if (fluid && stage.running) {
        const before = trail.current.get(pointer.id)
        const at = input.event.timeStamp
        if (input.type === 'move' && before && at - before.at < TRAIL_MS) {
          fluid.splat(
            pointer.x / cssWidth,
            1 - pointer.y / cssHeight,
            (pointer.x - before.x) / cssWidth,
            (before.y - pointer.y) / cssHeight
          )
        }
        if (input.type === 'up' && pointer.type !== 'mouse') trail.current.delete(pointer.id)
        else trail.current.set(pointer.id, { x: pointer.x, y: pointer.y, at })
      }
      if (!stage.running) stage.redraw()
    },
    onContextRestored: () => {
      // Everything the old context held is gone: compile again
      const gl = glRef.current
      if (!gl) return
      const manager = new ShaderManager(gl)
      managerRef.current = manager
      build(manager, compiledRef.current)
      fluidRef.current = fluidOn.current ? new FluidSim(gl, manager) : null
    }
  })
  const { redraw, clock } = stage

  // A control that moves while paused still changes the picture
  useEffect(() => {
    paramsRef.current = params
    compiledRef.current = compiled
    redraw()
  }, [params, compiled, redraw])

  // The one context, the first program, and a shared link if there is one
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const boot = async () => {
      setBoot('Compiling the shader')
      const encoded = /^#s=(.+)/.exec(window.location.hash)?.[1]
      const shared = encoded ? await decodeShare(encoded).catch(() => null) : await null
      if (cancelled) return

      const gl = glRef.current ?? canvas.getContext('webgl2', { alpha: false, antialias: false })
      if (!gl) {
        setSupport({ webgl2: false, fluid: false })
        return
      }
      glRef.current = gl
      const manager = new ShaderManager(gl)
      managerRef.current = manager

      const first = shared ?? PRESETS[0].source
      const result = build(manager, first)
      // A shared shader that does not compile still needs something to run
      if (result.ok) setCompiled(first)
      else build(manager, PRESETS[0].source)
      if (shared !== null) {
        const match = PRESETS.find(item => item.id !== FLUID && item.source === shared)
        if (match) setPresetId(match.id)
        setSource(shared)
      } else if (encoded) {
        setNote('That link could not be read, so this is the default shader.')
      }
      setCompile(result)
      setSupport({ webgl2: true, fluid: FluidSim.supported(gl) })
      // Read from the browser: the shell's own flag is not settled this early
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      clock.current.time = still ? STILL_TIME : 0
      setTime(clock.current.time)
      redraw()
    }
    boot()
    return () => {
      cancelled = true
      clearTimeout(quiet.current)
      fluidRef.current?.dispose()
      fluidRef.current = null
      managerRef.current?.dispose()
      managerRef.current = null
    }
  }, [clock, redraw, setBoot])

  // The entrance: once the canvas is up, the source writes itself in
  useEffect(() => {
    if (!isReady || reducedMotion || entered.current) return
    const started = performance.now()
    let raf = requestAnimationFrame(function write(now) {
      const progress = Math.min(1, (now - started) / ENTRANCE_MS)
      if (progress < 1) {
        setTyped(progress)
        raf = requestAnimationFrame(write)
      } else {
        entered.current = true
        setTyped(null)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [isReady, reducedMotion])

  // The Time readout, four times a second
  useEffect(() => {
    const sync = () => setTime(clock.current.time)
    if (!stage.running) {
      const once = setTimeout(sync)
      return () => clearTimeout(once)
    }
    const timer = setInterval(sync, 250)
    return () => clearInterval(timer)
  }, [stage.running, clock])

  useShortcut('E', 'Hide or show the editor', () => setEditorOpen(open => !open))

  const run = (text: string) => {
    clearTimeout(quiet.current)
    const manager = managerRef.current
    if (!manager) return
    const result = build(manager, text)
    setCompile(result)
    if (result.ok) setCompiled(text)
    redraw()
  }

  const edit = (text: string) => {
    setSource(text)
    setNote('')
    clearTimeout(quiet.current)
    quiet.current = setTimeout(() => run(text), COMPILE_QUIET_MS)
  }

  const choose = (id: string) => {
    const next = PRESETS.find(item => item.id === id)
    const gl = glRef.current
    const manager = managerRef.current
    if (!next || !gl || !manager) return
    if (id === FLUID) {
      try {
        fluidRef.current ??= new FluidSim(gl, manager)
      } catch {
        setSupport({ webgl2: true, fluid: false })
        return
      }
    }
    fluidOn.current = id === FLUID
    mouse.current = [0, 0, 0, 0]
    trail.current.clear()
    setPresetId(id)
    setSource(next.source)
    setValues({})
    setNote('')
    run(next.source)
  }

  const scrub = (seconds: number) => {
    clock.current.time = seconds
    setTime(seconds)
    redraw()
  }

  const restart = () => {
    frameBase.current = clock.current.frame
    fluidRef.current?.reset()
    scrub(0)
  }

  const copyLink = async () => {
    const encoded = await encodeShare(source)
    if (encoded.length > SHARE_LIMIT) {
      setNote(
        `Too long to share. A link holds ${kilobytes(SHARE_LIMIT)} of compressed source and this shader needs ${kilobytes(encoded.length)}.`
      )
      return
    }
    window.history.replaceState(null, '', `#s=${encoded}`)
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNote('Link copied.')
    } catch {
      setNote('The link is in the address bar. Copy it from there.')
    }
  }

  const available = PRESETS.filter(item => item.id !== FLUID || support?.fluid)

  if (support && !support.webgl2) {
    return (
      <>
        <Stage pausable={false}>
          <Poster
            action={
              <div className="shader-poster-source">
                <Editor value={constellation} label="Source of the Constellation shader" readOnly />
              </div>
            }>
            This browser has no WebGL2, so the shaders cannot run here. This is the source of the first one.
          </Poster>
        </Stage>
        <ShaderNotes presets={available} runnable={false} />
      </>
    )
  }

  const editor = (
    <>
      <Editor
        value={entering ? source.slice(0, Math.floor((typed ?? 0) * source.length)) : source}
        label="Shader source"
        describedBy={hintId}
        readOnly={isFluid || entering}
        errorLines={errors?.flatMap(error => (error.line ? [error.line] : []))}
        onChange={edit}
        onCompile={() => run(source)}
      />
      <div className="shader-status">
        <div aria-live="polite">
          {errors?.slice(0, 3).map((error, index) => (
            <p key={index} data-signal="change">
              {error.line ? `Line ${error.line}: ` : 'Error: '}
              {error.message}
            </p>
          ))}
        </div>
        {isFluid ? (
          <p id={hintId}>
            The solver is seven passes. This is the last, and it is read-only.{' '}
            <a href={sourceUrl('src/components/demo/shader/FluidSim.ts')} target="_blank" rel="noreferrer">
              Read the solver
            </a>
          </p>
        ) : (
          <p id={hintId} className="shader-hint">
            Tab indents. Escape, then Tab, leaves the editor.
          </p>
        )}
      </div>
    </>
  )

  const rail = (
    <>
      <Select
        label="Shader"
        value={edited ? 'yours' : presetId}
        onChange={choose}
        options={[
          ...available.map(item => ({ value: item.id, label: item.name })),
          ...(edited ? [{ value: 'yours', label: 'Yours' }] : [])
        ]}
      />
      {controls.map(control => {
        const label = labelFor(control.name)
        const value = params[control.name]
        const set = (next: Value) => setValues(current => ({ ...current, [control.name]: next }))
        if (control.kind === 'slider') {
          return (
            <Slider
              key={control.name}
              label={label}
              value={value as number}
              min={control.min}
              max={control.max}
              step={stepFor(control.min, control.max)}
              defaultValue={control.default}
              onChange={set}
            />
          )
        }
        if (control.kind === 'toggle') {
          return <Toggle key={control.name} label={label} checked={value as boolean} onChange={set} />
        }
        return (
          <label key={control.name} className="shader-color">
            <span>{label}</span>
            <input type="color" value={toHex(value as number[])} onChange={event => set(fromHex(event.target.value))} />
          </label>
        )
      })}
      {paused && !isFluid ? (
        <Slider
          label="Time"
          value={Math.round(time * 10) / 10}
          min={0}
          max={Math.max(60, Math.ceil(time))}
          step={0.1}
          format={seconds => `${seconds.toFixed(1)} s`}
          onChange={scrub}
        />
      ) : (
        <div className="demo-field shader-readout">
          <div className="demo-field-head">
            <span>Time</span>
            <output>{time.toFixed(1)} s</output>
          </div>
        </div>
      )}
      <Actions>
        <Button onClick={() => setPaused(!paused)}>{paused ? 'Play' : 'Pause'}</Button>
        <Button onClick={restart}>Restart</Button>
      </Actions>
      <Segmented
        label="Resolution"
        value={stage.autoScale ? 'auto' : stage.scale === 1 ? 'full' : 'half'}
        onChange={choice => stage.setScale(choice === 'auto' ? null : choice === 'full' ? 1 : 0.5)}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'full', label: '1x' },
          { value: 'half', label: '0.5x' }
        ]}
      />
      <Actions>
        {!isFluid && <Button onClick={copyLink}>Copy link</Button>}
        <Button onClick={() => choose(presetId)}>Reset</Button>
      </Actions>
      <p className="shader-note" role="status">
        {note}
      </p>
    </>
  )

  const rows: LedgerRow[] = [
    { key: 'Frame', value: stage.frameMs ? `${stage.frameMs.toFixed(1)} ms` : 'measuring' },
    {
      key: 'Resolution',
      value: `${stage.size.width} x ${stage.size.height} at ${stage.size.ratio.toFixed(1)}x`
    }
  ]
  if (compile?.ok) rows.push({ key: 'Compiled', value: `in ${compile.ms.toFixed(compile.ms < 10 ? 1 : 0)} ms` })
  else if (compile) rows.push({ key: 'Compiled', value: 'failed, running last good version', signal: 'change' })

  return (
    <>
      <Stage>
        <canvas
          ref={node => {
            canvasRef.current = node
            stage.ref(node)
          }}
          className="demo-canvas"
          aria-label={edited ? 'Your shader, drawn from the source in the editor.' : `${preset.name}. ${preset.description}`}
        />
        {!phone && (
          <aside
            className="shader-panel demo-chrome"
            aria-label="Source"
            data-open={editorOpen ? 'true' : 'false'}
            data-ready={isReady ? 'true' : 'false'}>
            <button
              type="button"
              className="demo-rail-toggle"
              aria-expanded={editorOpen}
              aria-controls={panelId}
              onClick={() => setEditorOpen(open => !open)}>
              <span>Source</span>
              <span className="demo-rail-toggle-state">{editorOpen ? 'Hide' : 'Show'}</span>
            </button>
            <div className="shader-panel-body" id={panelId} hidden={!editorOpen}>
              {editor}
            </div>
          </aside>
        )}
        <Rail
          tabs={
            phone
              ? [
                  { id: 'controls', label: 'Controls', content: rail },
                  { id: 'source', label: 'Source', content: <div className="shader-sheet-source">{editor}</div> }
                ]
              : undefined
          }>
          {rail}
        </Rail>
        <Ledger rows={rows} />
      </Stage>
      <ShaderNotes presets={available} runnable />
    </>
  )
}

function ShaderNotes({ presets, runnable }: { presets: Preset[]; runnable: boolean }) {
  const fluid = presets.some(item => item.id === FLUID)
  return (
    <Notes slug="shader">
      <NotesSection title="What you are looking at">
        <p>
          A fragment shader: a small program that runs once for every pixel, every frame, and returns that
          pixel&rsquo;s colour.{' '}
          {runnable ? (
            <>
              <span className="shader-wide">The source is on the left.</span>
              <span className="shader-narrow">The source is under the Source tab.</span> Change it.
            </>
          ) : (
            'The source above is one of them.'
          )}
        </p>
        <p>The list holds {presets.length} to start from:</p>
        <ul className="shader-list">
          {presets.map(item => (
            <li key={item.id}>
              <span className="demo-key">{item.name}</span> {item.description}
            </li>
          ))}
        </ul>
      </NotesSection>
      <NotesSection title="How it works">
        <p>
          Every shader here defines one function, <code>mainImage(out vec4 fragColor, in vec2 fragCoord)</code>. It
          is handed <code>fragCoord</code>, the pixel&rsquo;s position counted in pixels from the bottom left corner,
          and writes that pixel&rsquo;s colour to <code>fragColor</code>. The page adds a few lines above your text to
          declare the inputs and a few below to call <code>mainImage</code>, then gives the whole to your graphics
          card&rsquo;s compiler.
        </p>
        <p>
          Four inputs are always there. <code>iResolution</code> is the size of the canvas in pixels,{' '}
          <code>iTime</code> is the seconds the shader has been running, <code>iFrame</code> counts the frames drawn,
          and <code>iMouse</code> is the pointer: <code>xy</code> is where it is while pressed and <code>zw</code> is
          where the press began. These are the names Shadertoy uses, so a shader pasted from there runs here as long
          as it is a single pass and reads no textures.
        </p>
        <p>
          A uniform followed by a comment becomes a control. <code>{'uniform float drift; // @slider 0 2 0.4'}</code>{' '}
          makes a slider from 0 to 2 that starts at 0.4. <code>{'// @color 0.82 0.82 0.82'}</code> after a{' '}
          <code>vec3</code> makes a colour picker, and <code>{'// @toggle false'}</code> after a <code>bool</code> makes a
          switch. A uniform without such a comment gets no control.
        </p>
        <p>
          The page compiles 150 ms after you stop typing. If the compiler rejects the text, its message appears under
          the editor, the line it names is underlined, and the canvas goes on running the last version that compiled.
        </p>
        <p>
          Copy link compresses the source and puts it in the address, after the #. Nothing is sent to a server: the
          link is the shader. A link holds up to 8 KB once compressed.
        </p>
        {fluid && (
          <p>
            Fluid is the exception. Its picture is not worked out from nothing each frame: the fluid&rsquo;s velocity
            and the dye in it are kept in textures on the graphics card and carried forward by seven passes. They
            move the velocity along itself, add the pointer&rsquo;s push, measure the divergence, solve for pressure
            in 20 Jacobi iterations, subtract the pressure&rsquo;s slope, move the dye, and draw it. The editor shows
            that last pass, and its sliders reach into the others.
          </p>
        )}
      </NotesSection>
      <NotesSource
        files={[
          'src/components/demo/shader/ShaderPlayground.tsx',
          'src/components/demo/shader/Editor.tsx',
          'src/components/demo/shader/FluidSim.ts',
          'src/lib/shader-source.ts',
          ...PRESETS.map(item => item.file)
        ]}
      />
    </Notes>
  )
}
