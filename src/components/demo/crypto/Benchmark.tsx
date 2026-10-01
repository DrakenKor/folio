'use client'

import { useEffect, useRef, useState } from 'react'
import { Actions, Button } from '@/components/demo/controls'
import type { WorkloadResult } from '@/lib/bench'
import { BenchClient, createBenchClient } from '@/lib/bench-client'

const SIZES = [1, 16, 64]

const LANES: Record<string, { name: string; signal?: 'compiled' | 'interpreted' }> = {
  rust: { name: 'Rust sha2', signal: 'compiled' },
  js: { name: 'JavaScript', signal: 'interpreted' },
  subtle: { name: 'crypto.subtle' }
}

const formatMs = (ms: number) => (ms >= 100 ? ms.toFixed(0) : ms.toFixed(1))

/** SHA-256 over the same seeded buffer in three lanes, run only when asked. */
export function Benchmark() {
  const client = useRef<BenchClient | null>(null)
  const [rows, setRows] = useState<{ size: number; result: WorkloadResult }[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const created = createBenchClient()
    client.current = created
    return () => created.dispose()
  }, [])

  const run = async () => {
    const active = client.current
    if (!active) return
    setRows([])
    setError(null)
    try {
      for (const size of SIZES) {
        setStatus(`Measuring ${size} MB`)
        const result = await active.run('sha256', size, {
          onSample: (side, _ms, index) => setStatus(`Measuring ${size} MB, ${LANES[side]?.name ?? side}, sample ${index + 1}`)
        })
        setRows(current => [...current, { size, result }])
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : ''
      if (message !== 'cancelled' && message !== 'disposed') setError(`The benchmark stopped: ${message || 'unknown error'}. Press Run to try again.`)
    }
    setStatus(null)
  }

  return (
    <div className="crypto-bench">
      <Actions>
        {status ? <Button onClick={() => client.current?.cancel()}>Stop</Button> : <Button onClick={run}>Run the benchmark</Button>}
        {status && <span role="status">{status}</span>}
        {error && (
          <span role="alert" data-signal="change">
            {error}
          </span>
        )}
      </Actions>
      {rows.length > 0 && (
        <table className="crypto-table">
          <caption>Median time to hash the buffer once. Shorter is faster.</caption>
          <tbody>
            {rows.map(({ size, result }) => {
              const ids = Object.keys(result.stats)
              const slowest = Math.max(...ids.map(id => result.stats[id].median))
              return (
                <tr key={size}>
                  <th scope="row">{size} MB</th>
                  <td>
                    {ids.map(id => (
                      <div className="crypto-lane" key={id}>
                        <span className="crypto-lane-name">{LANES[id]?.name ?? id}</span>
                        <span className="crypto-lane-track">
                          <span className="crypto-lane-bar" data-lane={id} style={{ width: `${(result.stats[id].median / slowest) * 100}%` }} />
                        </span>
                        <span className="crypto-lane-ms" data-signal={LANES[id]?.signal}>
                          {formatMs(result.stats[id].median)} ms
                        </span>
                      </div>
                    ))}
                    {!result.valid ? (
                      <p data-signal="change">Outputs differ</p>
                    ) : (
                      result.faster && result.ratio && (
                        <p>
                          Fastest here: {LANES[result.faster]?.name ?? result.faster}, {result.ratio.toFixed(1)}x ahead of the next lane.
                        </p>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
