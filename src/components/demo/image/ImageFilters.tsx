'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, useDemoShell } from '@/components/demo/DemoShell'
import { Ledger, LedgerRow } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Rail, useIsPhone } from '@/components/demo/Rail'
import { Actions, Button, Segmented, Select, Slider } from '@/components/demo/controls'
import { useStage } from '@/hooks/useStage'
import { verdict } from '@/lib/bench'
import { FilterId, filterCall } from '@/lib/image-filters'
import type { Engine } from '@/lib/image.worker'
import { KernelGrid, KernelState, kernelOf } from './KernelGrid'
import { Seam } from './Seam'
import { Sweep } from './Sweep'
import { ImageClient, MAX_EDGE, PREVIEW_EDGE, Rect, RunResult, WorkerStatus, decode, edgeSize, fit, readPixels, testChart } from './pipeline'
import './image.css'

type Source = 'portrait' | 'chart' | 'upload' | 'camera'
type Sample = 'portrait' | 'chart'

interface Display {
  orig: ImageBitmap
  // The original is owned by a camera frame; samples and uploads are shared
  ownsOrig: boolean
  filt: ImageBitmap | null
}

interface Stats {
  w: number
  h: number
  rustMs: number | null
  jsMs: number | null
  maxError: number | null
  preview: boolean
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'blur', label: 'Blur' },
  { id: 'sharpen', label: 'Sharpen' },
  { id: 'edges', label: 'Edges' },
  { id: 'emboss', label: 'Emboss' },
  { id: 'greyscale', label: 'Greyscale' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'invert', label: 'Invert' },
  { id: 'brightness', label: 'Brightness' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'custom', label: 'Custom kernel' }
]

const AMOUNTS: Partial<Record<FilterId, { label: string; min: number; max: number; step: number; def: number; unit?: string }>> = {
  blur: { label: 'Radius', min: 0, max: 32, step: 1, def: 6, unit: ' px' },
  sharpen: { label: 'Strength', min: 0, max: 3, step: 0.1, def: 1 },
  brightness: { label: 'Brightness', min: -1, max: 1, step: 0.05, def: 0 },
  contrast: { label: 'Contrast', min: -1, max: 1, step: 0.05, def: 0 },
  emboss: { label: 'Depth', min: 0, max: 4, step: 0.1, def: 1 }
}

const DEFAULTS = Object.fromEntries(FILTERS.map(f => [f.id, AMOUNTS[f.id]?.def ?? 0])) as Record<FilterId, number>

const ALT: Record<Source, string> = {
  portrait: 'Portrait: a bold black and cream graphic of a bearded face made of swirling shapes',
  chart: 'Test chart: colour bars, a greyscale ramp, fine line pairs, a zone plate and a checkerboard',
  upload: 'Your image',
  camera: 'Live view from your camera'
}

const SAMPLE_OPTIONS = [
  { value: 'portrait' as const, label: 'Portrait' },
  { value: 'chart' as const, label: 'Test chart' },
  { value: 'upload' as const, label: 'Upload' },
  { value: 'camera' as const, label: 'Camera' }
]

const EMPTY = 'Drop a photo here, or pick a sample.'
const INSET_TOP = 64
// Desktop keeps the image left of the rail and above the strip; phones also clear the ledger
const INSET_BOTTOM = 60
const INSET_BOTTOM_PHONE = 172
const RAIL_RESERVE = 360
const CAMERA_WINDOW = 30

const cell = (n: number) => String(Number(n.toFixed(4)))

// The grid a filter shows when the visitor has not edited one
function gridFor(filter: FilterId, amount: number): KernelState {
  const make = (cells: number[], divisor = 1): KernelState => ({ size: 3, cells: cells.map(cell), divisor: String(divisor) })
  switch (filter) {
    case 'blur':
      return make([1, 2, 1, 2, 4, 2, 1, 2, 1], 16)
    case 'edges':
      return make([-1, 0, 1, -2, 0, 2, -1, 0, 1])
    case 'sharpen':
    case 'emboss': {
      const call = filterCall(filter, amount)
      return make(call.primitive === 'convolve' ? call.kernel : [])
    }
    default:
      return make([0, 0, 0, 0, 1, 0, 0, 0, 0])
  }
}

const CAPTION: Partial<Record<FilterId, string>> = {
  custom: 'Each output pixel is the weighted sum of its neighbours, divided by the divisor.',
  edges: 'Edges runs this kernel and its transpose, then combines the two into one magnitude.',
  blur: 'Blur runs a separable Gaussian. This grid is the 3x3 kernel that approximates a small blur.',
  sharpen: 'The kernel this filter runs. Edit a cell to change it.',
  emboss: 'The kernel this filter runs. Edit a cell to change it.'
}
const COLOUR_CAPTION = 'This filter is a colour matrix, not a kernel. Edit a cell to run the grid instead.'

const layoutBox = (cssWidth: number, cssHeight: number, phone: boolean): Rect => ({
  x: 0,
  y: INSET_TOP,
  w: phone ? cssWidth : cssWidth - RAIL_RESERVE,
  h: cssHeight - INSET_TOP - (phone ? INSET_BOTTOM_PHONE : INSET_BOTTOM)
})

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

export function ImageFilters() {
  const { reducedMotion } = useDemoShell()
  const [source, setSource] = useState<Source>('portrait')
  const [bitmaps, setBitmaps] = useState<Partial<Record<Source, ImageBitmap>>>({})
  const [engine, setEngine] = useState<Engine>('both')
  const [filter, setFilter] = useState<FilterId>('blur')
  const [amounts, setAmounts] = useState(DEFAULTS)
  const [custom, setCustom] = useState<KernelState | null>(null)
  const [size, setSize] = useState(2048)
  const [tick, setTick] = useState(0)
  const [worker, setWorker] = useState<WorkerStatus | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [cameraSize, setCameraSize] = useState<{ w: number; h: number } | null>(null)
  const [seamActive, setSeamActive] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const client = useRef<ImageClient | null>(null)
  const display = useRef<Display | null>(null)
  const seam = useRef(0.5)
  const dragging = useRef(false)
  const previous = useRef<Source>('portrait')
  const shown = useRef(0)
  const pixels = useRef<{ bitmap: ImageBitmap; w: number; h: number; data: ImageData } | null>(null)
  const times = useRef<{ rust: number[]; js: number[]; last: number }>({ rust: [], js: [], last: 0 })

  const phone = useIsPhone()
  const phoneRef = useRef(phone)
  const wasm = worker?.wasm
  const effectiveEngine: Engine = wasm === false ? 'js' : engine
  const camera = source === 'camera'
  const bitmap = camera ? undefined : bitmaps[source]
  const grid = filter === 'custom' && custom ? custom : gridFor(filter, amounts[filter])
  const call = useMemo(
    () => (filter === 'custom' ? filterCall('custom', 0, kernelOf(grid)) : filterCall(filter, amounts[filter])),
    [filter, amounts, grid]
  )

  // Both bitmaps are drawn clipped at the seam: dragging costs one drawImage pair
  const draw = (frame: { width: number; height: number; cssWidth: number; cssHeight: number; ratio: number }) => {
    const ctx = canvasRef.current?.getContext('2d')
    const d = display.current
    if (!ctx) return
    ctx.clearRect(0, 0, frame.width, frame.height)
    if (!d) return
    const r = fit(layoutBox(frame.cssWidth, frame.cssHeight, phoneRef.current), d.orig.width, d.orig.height)
    const [x, y, w, h] = [r.x, r.y, r.w, r.h].map(v => v * frame.ratio)
    const cut = Math.round(x + seam.current * w)
    ctx.imageSmoothingQuality = 'high'
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, d.filt ? cut - x : w, h)
    ctx.clip()
    ctx.drawImage(d.orig, x, y, w, h)
    ctx.restore()
    if (d.filt) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(cut, y, x + w - cut, h)
      ctx.clip()
      ctx.drawImage(d.filt, x, y, w, h)
      ctx.restore()
    }
    stage.ready()
  }

  const stage = useStage({ loop: false, touchAction: 'pan-y', onFrame: draw, onResize: size => draw(size) })
  const { redraw, ready } = stage
  useEffect(() => {
    phoneRef.current = phone
    redraw()
  }, [phone, redraw])

  const rect = useMemo(() => {
    const dims = bitmap ?? cameraSize
    return fit(layoutBox(stage.size.cssWidth, stage.size.cssHeight, phone), dims ? ('width' in dims ? dims.width : dims.w) : 0, dims ? ('height' in dims ? dims.height : dims.h) : 0)
  }, [bitmap, cameraSize, phone, stage.size.cssWidth, stage.size.cssHeight])

  const choose = useCallback((next: Source) => {
    if (next !== 'camera') previous.current = next
    setSource(next)
    setNote(null)
  }, [])

  const loadBlob = useCallback(
    async (blob: Blob) => {
      try {
        const decoded = await decode(blob)
        setBitmaps(all => ({ ...all, upload: decoded }))
        setLoadFailed(false)
        choose('upload')
      } catch {
        setNote(`That file could not be read as an image. ${EMPTY}`)
      }
    },
    [choose]
  )

  // The worker lives as long as the page
  useEffect(() => {
    const created = new ImageClient(setWorker)
    client.current = created
    return () => {
      created.dispose()
      client.current = null
    }
  }, [])

  // Samples decode once, on first use
  useEffect(() => {
    if (source !== 'portrait' && source !== 'chart') return
    if (bitmaps[source]) return
    let cancelled = false
    const load = (source === 'portrait' ? fetch('/profile.png').then(res => res.blob()).then(decode) : testChart())
    load.then(
      loaded => {
        if (!cancelled) setBitmaps(all => ({ ...all, [source]: loaded }))
      },
      () => {
        if (!cancelled) {
          setLoadFailed(true)
          ready()
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [source, bitmaps, ready])

  const show = useCallback(
    (orig: ImageBitmap, ownsOrig: boolean, filt: ImageBitmap | null) => {
      const old = display.current
      display.current = { orig, ownsOrig, filt }
      if (old) {
        if (old.ownsOrig && old.orig !== orig) old.orig.close()
        old.filt?.close()
      }
      redraw()
    },
    [redraw]
  )

  const finish = useCallback(
    async (result: RunResult | Error, orig: ImageBitmap, ownsOrig: boolean, preview: boolean) => {
      if (result instanceof Error) {
        setNote(`The filter failed: ${result.message}. Choose another filter or source.`)
        return
      }
      const mine = ++shown.current
      const filt = await createImageBitmap(result.pixels)
      if (mine !== shown.current) {
        filt.close()
        if (ownsOrig) orig.close()
        return
      }
      show(orig, ownsOrig, filt)
      setSeamActive(true)
      const log = times.current
      const next: Stats = { w: result.pixels.width, h: result.pixels.height, rustMs: result.rustMs, jsMs: result.jsMs, maxError: result.maxError, preview }
      if (!camera) {
        setStats(next)
        return
      }
      // Camera: the mean of the last frames, shown twice a second
      for (const [key, ms] of [['rust', result.rustMs], ['js', result.jsMs]] as const) {
        if (ms !== null) log[key] = [...log[key], ms].slice(-CAMERA_WINDOW)
      }
      if (performance.now() - log.last > 500) {
        log.last = performance.now()
        setStats({ ...next, rustMs: log.rust.length ? mean(log.rust) : null, jsMs: log.js.length ? mean(log.js) : null })
      }
    },
    [camera, show]
  )

  // Still images: show the original at once, then run the filter on a worker
  useEffect(() => {
    const worker = client.current
    if (!bitmap || !worker) return
    if (display.current?.orig !== bitmap) show(bitmap, false, null)
    const preview = dragging.current
    const [fw, fh] = edgeSize(bitmap.width, bitmap.height, size === 0 ? MAX_EDGE : size)
    const [w, h] = preview ? edgeSize(fw, fh, PREVIEW_EDGE) : [fw, fh]
    const cached = pixels.current
    if (!cached || cached.bitmap !== bitmap || cached.w !== w || cached.h !== h) {
      pixels.current = { bitmap, w, h, data: readPixels(bitmap, w, h) }
    }
    worker.request({ call, engine: effectiveEngine, w, h, pixels: pixels.current!.data.data.slice() }, result => void finish(result, bitmap, false, preview))
  }, [bitmap, call, effectiveEngine, size, tick, finish, show])

  // Camera: each video frame goes through the selected engine
  const live = useRef({ call, engine: effectiveEngine, size })
  useEffect(() => {
    live.current = { call, engine: effectiveEngine, size }
  })
  useEffect(() => {
    if (!camera) return
    let stopped = false
    let working = false
    let stream: MediaStream | null = null
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    times.current = { rust: [], js: [], last: 0 }

    const frame = async () => {
      const worker = client.current
      if (stopped || working || !worker || worker.busy || !video.videoWidth) return
      working = true
      const { call: c, engine: e, size: s } = live.current
      const [w, h] = edgeSize(video.videoWidth, video.videoHeight, s === 0 ? MAX_EDGE : s)
      const data = readPixels(video, w, h)
      const orig = await createImageBitmap(data)
      setCameraSize({ w, h })
      working = false
      if (stopped) return orig.close()
      worker.request({ call: c, engine: e, w, h, pixels: data.data }, result => {
        if (stopped) orig.close()
        else void finish(result, orig, true, false)
      })
    }
    const next = () => {
      if (stopped) return
      void frame()
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(next)
      else requestAnimationFrame(next)
    }

    Promise.resolve()
      .then(() => navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } } }))
      .then(async granted => {
        if (stopped) return granted.getTracks().forEach(track => track.stop())
        stream = granted
        video.srcObject = granted
        await video.play()
        next()
      })
      .catch(() => {
        if (stopped) return
        stream?.getTracks().forEach(track => track.stop())
        setNote('Camera permission was denied, so the previous source is back. Allow the camera in your browser to try again.')
        setSource(previous.current)
      })

    return () => {
      stopped = true
      stream?.getTracks().forEach(track => track.stop())
      video.srcObject = null
    }
  }, [camera, finish])

  // Drop and paste anywhere on the page
  useEffect(() => {
    const first = (files: FileList | null | undefined) => Array.from(files ?? []).find(file => file.type.startsWith('image/'))
    const onOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const file = first(event.dataTransfer?.files)
      if (!file) return
      event.preventDefault()
      void loadBlob(file)
    }
    const onPaste = (event: ClipboardEvent) => {
      const file = first(event.clipboardData?.files)
      if (file) void loadBlob(file)
    }
    document.addEventListener('dragover', onOver)
    document.addEventListener('drop', onDrop)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('paste', onPaste)
    }
  }, [loadBlob])

  const setAmount = (value: number) => {
    dragging.current = true
    setAmounts(all => ({ ...all, [filter]: value }))
  }
  const commitAmount = () => {
    dragging.current = false
    setTick(count => count + 1)
  }

  const edit = (next: KernelState) => {
    dragging.current = false
    setCustom(next)
    setFilter('custom')
  }

  const pickFilter = (id: FilterId) => {
    dragging.current = false
    if (id === 'custom' && !custom) setCustom(grid)
    setFilter(id)
  }

  const pickSource = (next: Source) => {
    if (next === 'upload' && !bitmaps.upload) fileRef.current?.click()
    else choose(next)
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void loadBlob(file)
  }

  const save = () => {
    const filt = display.current?.filt
    if (!filt) return
    const out = document.createElement('canvas')
    out.width = filt.width
    out.height = filt.height
    out.getContext('2d')!.drawImage(filt, 0, 0)
    out.toBlob(blob => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'image-filtered.png'
      link.click()
      URL.revokeObjectURL(link.href)
    }, 'image/png')
  }

  const amount = AMOUNTS[filter]
  const showRust = effectiveEngine !== 'js' || wasm === false
  const showJs = effectiveEngine !== 'rust'
  const time = (ms: number | null) => (ms === null ? '...' : camera ? `${(1000 / ms).toFixed(0)} fps` : `${ms.toFixed(1)} ms`)
  const both = stats && stats.rustMs !== null && stats.jsMs !== null
  const agrees = both && (stats.maxError ?? 0) <= 1
  const verdictText = both && agrees ? verdict([{ label: 'Rust', median: stats.rustMs! }, { label: 'JavaScript', median: stats.jsMs! }])?.text : null

  const rows: LedgerRow[] = [
    {
      key: 'Image',
      value: stats
        ? `${stats.w} x ${stats.h}${bitmap && (bitmap.width !== stats.w || bitmap.height !== stats.h) ? ` of ${bitmap.width} x ${bitmap.height}` : ''}${stats.preview ? ', preview' : ''}`
        : '...'
    }
  ]
  if (showRust) rows.push({ key: 'Rust', value: wasm === false ? 'unavailable' : time(stats?.rustMs ?? null), signal: wasm === false ? undefined : 'compiled' })
  if (showJs) rows.push({ key: 'JavaScript', value: time(stats?.jsMs ?? null), signal: 'interpreted' })
  if (!camera && showRust && showJs && wasm && both) {
    rows.push(agrees ? { key: 'Verdict', value: verdictText ?? '...' } : { key: 'Verdict', value: 'Outputs differ', signal: 'change' })
  }

  const filterTab = (
    <>
      <Segmented
        label="Engine"
        value={effectiveEngine}
        onChange={setEngine}
        options={[
          { value: 'rust', label: 'Rust', disabled: wasm === false },
          { value: 'js', label: 'JavaScript' },
          { value: 'both', label: 'Both', disabled: wasm === false }
        ]}
      />
      {wasm === false && <p className="image-note">WebAssembly could not be loaded, so every filter runs in JavaScript.</p>}
      {amount && (
        <Slider
          key={filter}
          label={amount.label}
          value={amounts[filter]}
          min={amount.min}
          max={amount.max}
          step={amount.step}
          defaultValue={amount.def}
          format={value => `${value.toFixed(amount.step < 1 ? (amount.step < 0.1 ? 2 : 1) : 0)}${amount.unit ?? ''}`}
          onChange={setAmount}
          onCommit={commitAmount}
        />
      )}
      <KernelGrid
        state={grid}
        onChange={edit}
        caption={CAPTION[filter] ?? COLOUR_CAPTION}
      />
    </>
  )

  const imageTab = (
    <>
      <Select label="Source" value={source} onChange={pickSource} options={SAMPLE_OPTIONS} />
      <Actions>
        <Button onClick={() => fileRef.current?.click()}>Choose a file</Button>
      </Actions>
      {note && (
        <p className="image-note" role="status" data-signal="change">
          {note}
        </p>
      )}
      {camera && <p className="image-note">Frames per second is 1000 divided by the mean filter time over the last 30 frames. Drawing and decoding are left out.</p>}
      <Segmented
        label="Size"
        value={size}
        onChange={setSize}
        options={[
          { value: 512, label: '512' },
          { value: 1024, label: '1024' },
          { value: 2048, label: '2048' },
          { value: 0, label: 'Original' }
        ]}
      />
      <Actions>
        <Button onClick={save} disabled={!stats}>
          Save image
        </Button>
      </Actions>
    </>
  )

  const sweepFilter = FILTERS.find(f => f.id === filter)!.label

  return (
    <>
      <Stage pausable={false} className="image-stage">
        <canvas
          ref={node => {
            canvasRef.current = node
            stage.ref(node)
          }}
          className="demo-canvas"
          aria-label={`${ALT[source]}. The original is left of the seam and the filtered image is right of it.`}
        />
        {loadFailed && !bitmap && <p className="image-empty">{EMPTY}</p>}
        <Seam rect={rect} active={seamActive} reducedMotion={reducedMotion} onChange={position => {
          seam.current = position
          redraw()
        }} />
        <div className="image-strip demo-chrome" role="group" aria-label="Filter">
          {FILTERS.map(f => (
            <button key={f.id} type="button" aria-pressed={f.id === filter} onClick={() => pickFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <Rail
          label="Image controls"
          tabs={[
            { id: 'filter', label: 'Filter', content: filterTab },
            { id: 'image', label: 'Image', content: imageTab }
          ]}
        />
        <Ledger rows={rows} />
        <input ref={fileRef} type="file" accept="image/*" className="demo-visually-hidden" tabIndex={-1} aria-label="Choose an image file" onChange={onFile} />
      </Stage>
      <Notes slug="image">
        <NotesSection title="What you are looking at">
          <p>
            A photograph and the same photograph after a filter, split by a line you can drag. The filter runs twice, once in Rust compiled to
            WebAssembly and once in JavaScript, on identical pixels. The default image is the graphic portrait from the home page: black and cream
            swirls shaped into a bearded face.
          </p>
          <p>
            The times in the ledger are a single run, the last one. If the two outputs differ by more than 1 in any channel the ledger says so and
            shows no speedup. Image sizes are read from the decoded image: uploads are decoded with the long edge capped at 4096 px, then drawn at the
            Size you choose before the filter runs.
          </p>
        </NotesSection>
        <NotesSection title="How it works">
          <p>
            A convolution replaces each pixel with the weighted sum of the pixels around it. The weights are the kernel grid in the rail: sharpen puts
            a large positive weight in the middle and negative ones around it, so a pixel that differs from its neighbours is pushed further away. The
            sum is divided by the divisor, and Normalise sets the divisor so that a flat area keeps its brightness.
          </p>
          <p>
            Greyscale, sepia, invert, brightness and contrast are one 4x5 colour matrix applied to each pixel. Edges runs the Sobel kernel and its
            transpose and keeps the magnitude. Blur is a Gaussian applied along rows and then along columns. At the edges of the image both engines
            repeat the nearest pixel, round with floor(x + 0.5) and never change alpha.
          </p>
          <p>
            The Rust time includes copying the pixels into WebAssembly memory and back out, because that copy is part of what calling Rust from
            JavaScript costs.
            {worker?.rawBytes ? ` The WebAssembly module this page loaded is ${formatBytes(worker.rawBytes)}, and it holds every Rust function on this site, not only these four.` : ''}
          </p>
        </NotesSection>
        <NotesSection title="Size sweep">
          <p>
            The sweep runs the current filter on square images of 256, 512, 1024, 2048 and 4096 px with the shared benchmark harness, in a worker of
            its own, and plots the median time against megapixels on log axes. It runs only when you ask, and it reports whatever it measures.
          </p>
          <Sweep call={call} filterLabel={sweepFilter} />
        </NotesSection>
        <NotesSource files={['wasm/src/image.rs', 'src/lib/image-filters.ts']} />
      </Notes>
    </>
  )
}
