'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ScrollLayout, useDemoShell } from '@/components/demo/DemoShell'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Actions, Button, Slider } from '@/components/demo/controls'
import type { WasmStatus, WorkloadResult } from '@/lib/bench'
import { createBenchClient, type BenchClient } from '@/lib/bench-client'
import { workloads, type Workload } from '@/lib/bench-workloads'
import { RaceLanes, type LanesHandle } from './RaceLanes'
import { ResultBars, type Live } from './ResultBars'
import { SweepChart, type SweepPoint } from './SweepChart'
import { TABLE_HEAD, cells, count, geomean, markdown, ms, verdictText } from './format'
import { readEnvironment, type Environment } from './environment'
import './bench.css'

const SAMPLES = 30
const MAIN = workloads.filter(w => w.group === 'main')
const SMALL = workloads.filter(w => w.group === 'small')
const SHOWN = [...MAIN, ...SMALL]
const STEP: Record<string, number> = {
  mandelbrot: 64,
  nbody: 250,
  matrix: 32,
  sieve: 100_000,
  sort: 10_000,
  'tiny-calls': 100_000,
  'strings-reverse': 100_000,
  'strings-count': 100_000,
}

const PHRASE: Record<string, string> = {
  'tiny-calls': 'a million tiny calls',
  'strings-reverse': 'reversing a 1 MB string',
  'strings-count': 'counting words in a 1 MB string',
  'sort-small': 'sorting 100 numbers',
}

type Busy = 'entrance' | 'run' | 'all' | 'section' | 'sweep'

// Five sizes spread evenly on a log scale across the workload's range, rounded to two significant figures.
function sweepSizes(w: Workload): number[] {
  const lo = Math.log(w.minSize)
  const hi = Math.log(w.maxSize)
  return Array.from({ length: 5 }, (_, i) => {
    if (i === 0) return w.minSize
    if (i === 4) return w.maxSize
    const raw = Math.exp(lo + ((hi - lo) * i) / 4)
    const unit = 10 ** (Math.floor(Math.log10(raw)) - 1)
    return Math.round(raw / unit) * unit
  })
}

function sectionSentence(results: Record<string, WorkloadResult>, wasm: boolean | null): string {
  if (wasm === false) return 'WebAssembly did not load, so there is nothing to compare here.'
  const ran = SMALL.filter(w => results[w.id])
  if (ran.length === 0) return 'Run this section to see, on your machine, when WebAssembly is worth reaching for.'
  const named = (rust: boolean) =>
    ran.filter(w => results[w.id].valid && results[w.id].faster === (rust ? 'rust' : 'js')).map(w => PHRASE[w.id] ?? w.label)
  const rust = named(true)
  const js = named(false)
  const differ = ran.filter(w => !results[w.id].valid).length
  const skipped = differ ? ` ${differ} result${differ > 1 ? 's were' : ' was'} left out because the outputs differed.` : ''
  if (rust.length + js.length === 0) return 'No verdicts here, because the outputs differed.'
  if (js.length === 0) return `On this run Rust was faster for ${rust.join(', ')}, so on this machine WebAssembly was worth reaching for in all of them.${skipped}`
  if (rust.length === 0) return `On this run JavaScript was faster for ${js.join(', ')}, so on this machine WebAssembly was not worth reaching for in any of them.${skipped}`
  return `On this run Rust was faster for ${rust.join(', ')}; JavaScript was faster for ${js.join(', ')}. So on this machine WebAssembly was worth reaching for in the first group and not in the second.${skipped}`
}

export function WasmBenchmark() {
  const { setReady, reducedMotion } = useDemoShell()
  const clientRef = useRef<BenchClient | null>(null)
  const lanesRef = useRef<LanesHandle | null>(null)
  const reducedRef = useRef(false)

  const [status, setStatus] = useState<WasmStatus | null>(null)
  const [env, setEnv] = useState<Environment | null>(null)
  const [selected, setSelected] = useState(MAIN[0].id)
  const [sizes, setSizes] = useState<Record<string, number>>(() => Object.fromEntries(SHOWN.map(w => [w.id, w.defaultSize])))
  const [results, setResults] = useState<Record<string, WorkloadResult>>({})
  const [live, setLive] = useState<Live | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [sweep, setSweep] = useState<{ id: string; points: SweepPoint[] } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => setReady(), [setReady])
  useEffect(() => {
    reducedRef.current = reducedMotion
  }, [reducedMotion])

  // One workload through the worker: the visible race (when it has one), then the timed run.
  const runOne = useCallback(async (w: Workload, size: number, inSweep = false): Promise<WorkloadResult> => {
    const client = clientRef.current
    if (!client) throw new Error('disposed')
    if (!inSweep) {
      flushSync(() => setSelected(w.id))
      lanesRef.current?.reset()
      setLive({ id: w.id, samples: {} })
      if (w.race && !reducedRef.current) {
        await client.race(w.id, size, (side, fraction, chunk) => lanesRef.current?.progress(w.id, side, fraction, `${Math.round(fraction * 100)}%`, chunk))
      }
    }
    return client.run(w.id, size, {
      onSample: (side, sampleMs, index) => {
        if (inSweep) return
        lanesRef.current?.progress(w.id, side, (index + 1) / SAMPLES, `timing ${index + 1} of ${SAMPLES}`)
        if (reducedRef.current) return
        setLive(prev => prev && { id: prev.id, samples: { ...prev.samples, [side]: [...(prev.samples[side] ?? []), sampleMs] } })
      },
    })
  }, [])

  // Runs jobs one after another. Announces once per workload, never per sample.
  const runJobs = useCallback(async (jobs: { w: Workload; size: number }[], kind: Busy) => {
    const client = clientRef.current
    setBusy(kind)
    setNotice(null)
    const started = performance.now()
    try {
      for (const [i, { w, size }] of jobs.entries()) {
        if (jobs.length > 1) setAnnounce(`Running ${i + 1} of ${jobs.length}: ${w.label}`)
        const result = await runOne(w, size)
        setResults(prev => ({ ...prev, [w.id]: result }))
        setLive(null)
        setAnnounce(`${w.label}: ${verdictText(result)}`)
      }
      if (kind === 'all' || kind === 'section') setNotice(`Ran ${jobs.length} workloads in ${((performance.now() - started) / 1000).toFixed(1)} s.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message === 'disposed') return
      setLive(null)
      setNotice(message === 'cancelled' ? 'Cancelled. Results already collected are kept. Run starts a fresh worker.' : `The run stopped: ${message}`)
      setAnnounce(message === 'cancelled' ? 'Cancelled' : 'The run stopped')
    } finally {
      if (clientRef.current === client) setBusy(null)
    }
  }, [runOne])

  const connect = useCallback(async (client: BenchClient) => {
    let next: WasmStatus
    try {
      next = await client.status()
    } catch {
      return false
    }
    if (clientRef.current !== client) return false
    setStatus(next)
    setEnv(readEnvironment(typeof Worker === 'undefined'))
    return true
  }, [])

  // The entrance: one finished Mandelbrot race at its small size.
  useEffect(() => {
    const client = createBenchClient()
    clientRef.current = client
    const entrance = workloads.find(w => w.id === 'mandelbrot')!
    void connect(client).then(async connected => {
      if (connected) await runJobs([{ w: entrance, size: entrance.entranceSize }], 'entrance')
    })
    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [connect, runJobs])

  const retry = () => {
    clientRef.current?.dispose()
    const client = createBenchClient()
    clientRef.current = client
    setStatus(null)
    setBusy(null)
    void connect(client)
  }

  const cancel = () => clientRef.current?.cancel()

  const runSweep = async (w: Workload) => {
    setBusy('sweep')
    setNotice(null)
    setSweep({ id: w.id, points: [] })
    setAnnounce(`Sweeping ${w.label} across five sizes`)
    const client = clientRef.current
    try {
      for (const size of sweepSizes(w)) {
        const r = await runOne(w, size, true)
        setSweep(prev => prev && { ...prev, points: [...prev.points, { size: r.size, rust: r.stats.rust?.median, js: r.stats.js?.median, valid: r.valid }] })
      }
      setAnnounce(`${w.label} sweep finished`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message === 'disposed') return
      setNotice(message === 'cancelled' ? 'Sweep cancelled.' : `The sweep stopped: ${message}`)
    } finally {
      if (clientRef.current === client) setBusy(null)
    }
  }

  const copy = async () => {
    const rows = SHOWN.map(w => ({ w, result: results[w.id] }))
    if (!rows.some(r => r.result)) return setNotice('Nothing to copy yet. Run a workload first.')
    try {
      await navigator.clipboard.writeText(markdown(rows))
      setNotice(`Copied ${rows.filter(r => r.result).length} rows as a Markdown table.`)
    } catch {
      setNotice('Could not copy. The table above can be selected by hand.')
    }
  }

  const w = SHOWN.find(entry => entry.id === selected) ?? MAIN[0]
  const wasm = status ? status.wasm : null
  const idle = busy === null
  const fixed = w.minSize === w.maxSize
  const rowsOf = (list: Workload[]) => list.map(entry => ({ w: entry, result: results[entry.id] }))
  const mean = geomean(MAIN.map(entry => results[entry.id]))
  const shownResults = SHOWN.filter(entry => results[entry.id])
  const sweepWorkload = sweep ? SHOWN.find(entry => entry.id === sweep.id) : undefined
  const size = results[w.id]?.size ?? sizes[w.id]

  return (
    <>
      <ScrollLayout visual={<RaceLanes key={w.id} ref={lanesRef} workload={w} size={size} result={results[w.id]} wasm={wasm} running={live?.id === w.id} />}>
        <h2>Workloads</h2>
        {status === null && <p className="wasm-status">Loading the WebAssembly module.</p>}
        {status?.wasm && <p className="wasm-status">The WebAssembly module loaded in {ms(status.info?.loadMs)}.</p>}
        {status && !status.wasm && (
          <div className="wasm-status wasm-status-failed" role="alert">
            <p>
              <span data-signal="change">The WebAssembly module failed to load.</span> {status.error}
            </p>
            <p>Without it this page is only a JavaScript benchmark: JavaScript timings are shown alone and no verdict is given.</p>
            <Button onClick={retry}>Retry</Button>
          </div>
        )}
        {env?.noWorker && <p className="wasm-note">This browser has no Worker support, so runs happen on the page and it will freeze while they run.</p>}

        <div className="wasm-controls">
          {fixed ? (
            <p className="wasm-fixed">{w.label}: fixed at {w.sizeLabel(w.minSize)}</p>
          ) : (
            <Slider
              label={`Size for ${w.label}`}
              value={sizes[w.id]}
              min={w.minSize}
              max={w.maxSize}
              step={STEP[w.id] ?? 1}
              defaultValue={w.defaultSize}
              format={w.sizeLabel}
              disabled={!idle}
              onChange={value => setSizes(prev => ({ ...prev, [w.id]: value }))}
            />
          )}
          <Actions>
            <Button variant="primary" disabled={!idle} onClick={() => runJobs([{ w, size: sizes[w.id] }], 'run')}>
              Run
            </Button>
            <Button disabled={!idle} onClick={() => runJobs(SHOWN.map(entry => ({ w: entry, size: sizes[entry.id] })), 'all')}>
              Run all
            </Button>
            {!idle && <Button onClick={cancel}>Cancel</Button>}
            <Button disabled={!idle || fixed} onClick={() => runSweep(w)}>
              Sweep
            </Button>
            <Button onClick={copy}>Copy results</Button>
          </Actions>
        </div>
        {notice && <p className="wasm-note">{notice}</p>}
        <p className="demo-visually-hidden" role="status" aria-live="polite">{announce}</p>

        <ResultBars rows={rowsOf(MAIN)} selected={selected} locked={!idle} live={live} wasm={wasm} onSelect={setSelected} />
        <p className="wasm-note">
          Bars inside a pair share a scale. Pairs do not, because the workloads differ by orders of magnitude. The whisker spans the 10th to 90th percentile of {SAMPLES} samples.
        </p>
        <p className="wasm-mean">
          {mean ? (
            <>Geometric mean of the speedups over {mean.n} workload{mean.n > 1 ? 's' : ''} where both sides ran and agreed: <strong>{mean.text}</strong></>
          ) : (
            'Geometric mean of the speedups: needs a result where both sides ran and agreed.'
          )}
        </p>

        <details className="wasm-table">
          <summary>Results as a table</summary>
          {shownResults.length === 0 ? (
            <p>No results yet.</p>
          ) : (
            <table>
              <thead>
                <tr>{TABLE_HEAD.map(head => <th key={head} scope="col">{head}</th>)}</tr>
              </thead>
              <tbody>
                {shownResults.map(entry => (
                  <tr key={entry.id}>{cells(entry, results[entry.id]).map((cell, i) => <td key={i}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </details>

        {sweep && sweepWorkload && <SweepChart workload={sweepWorkload} points={sweep.points} />}

        <h2>Small work and strings</h2>
        <p>
          Cases where crossing into WebAssembly is large next to the work done: a million tiny calls, text copied in and out, and a sort of 100 numbers. Each row is worded like every other row.
        </p>
        <ResultBars rows={rowsOf(SMALL)} selected={selected} locked={!idle} live={live} wasm={wasm} onSelect={setSelected} />
        <Actions>
          <Button disabled={!idle} onClick={() => runJobs(SMALL.map(entry => ({ w: entry, size: sizes[entry.id] })), 'section')}>
            Run this section
          </Button>
        </Actions>
        <p>{sectionSentence(results, wasm)}</p>

        <h2>Environment</h2>
        <dl className="wasm-ledger" aria-label="Environment, read when the page loaded">
          <div>
            <dt>Module</dt>
            <dd data-signal={status && !status.wasm ? 'change' : undefined}>
              {status === null ? 'loading' : status.wasm ? `loaded in ${ms(status.info?.loadMs)}` : 'failed to load'}
            </dd>
          </div>
          <div>
            <dt>Binary</dt>
            <dd>
              {status?.info
                ? `${count(status.info.rawBytes)} bytes raw${status.info.encodedBytes !== null && status.info.encodedBytes !== status.info.rawBytes ? `, ${count(status.info.encodedBytes)} bytes compressed` : ''}`
                : status ? 'not loaded' : ''}
            </dd>
          </div>
          <div>
            <dt>Browser</dt>
            <dd>{env?.browser ?? ''}</dd>
          </div>
          <div>
            <dt>Cores</dt>
            <dd>{env?.cores ?? ''}</dd>
          </div>
          <div>
            <dt>Timer resolution</dt>
            <dd>{env ? (env.timer === null ? 'not measurable' : ms(env.timer)) : ''}</dd>
          </div>
          <div>
            <dt>SIMD</dt>
            <dd>{env ? (env.simd ? 'supported' : 'not supported') : ''}</dd>
          </div>
        </dl>
      </ScrollLayout>
      <Notes slug="wasm">
        <NotesSection title="What you are looking at">
          <p>
            The same jobs, written once in Rust and once in JavaScript, timed on your machine just now. Different machines and browsers give different answers. Nothing on this page is a stored number: every figure was measured in this tab.
          </p>
          <p>
            The pictures show what each job computes. Mandelbrot is an image filled in row by row, N-body is the final positions as points, matrix multiply is a heat map of the product, the prime sieve is the primes under 10,000 on an Ulam spiral, and sort is the array as a line before and after.
          </p>
        </NotesSection>
        <NotesSection title="How it is measured">
          <p>
            Each side warms up for 200 ms. Browsers round <code>performance.now()</code> to between 0.1 and 1 ms, so every sample is sized to last at least 20 ms and the time per call is its span divided by the calls inside it. Then 30 samples are taken, alternating the two sides so that drift from heat does not favour either. The bar is the median; the whisker is the 10th to 90th percentile.
          </p>
          <p>
            Both sides get the same seeded input, and their outputs are compared before any verdict: exactly for integers, bytes and strings, and to a relative error of 1e-9 for floating point. If they differ the row says so and shows no verdict. Setup, such as making inputs, is outside the timed span for both.
          </p>
          <p>
            Rust&apos;s times include copying data into WebAssembly memory and back out, because a JavaScript caller pays that cost. The JavaScript sort is the built-in typed-array sort, which is native code inside the browser. Mandelbrot, N-body, matrix multiply and the sieve are loops written for typed arrays with no allocation in the inner loop.
          </p>
          <p>
            The visible race is separate from the timed run. It is untimed, it is cut into small pieces so it can draw, and it gives each lane equal processor time per turn so that progress reflects each engine&apos;s real speed. Its progress is for show and no number comes from it.
          </p>
        </NotesSection>
        <NotesSection title="What it does not show">
          <p>
            Startup cost beyond the module load time in the environment list, memory use, and anything that uses threads or SIMD. One browser on one machine is also one sample of the world.
          </p>
        </NotesSection>
        <NotesSource files={['wasm/src/bench.rs', 'src/lib/bench-workloads.ts', 'src/lib/bench.ts']} />
      </Notes>
    </>
  )
}
