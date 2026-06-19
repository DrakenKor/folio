'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, TOTAL_BIASES } from './data'
import VoodooDoll, { makeNeedle, type Needle } from './VoodooDoll'

const STORAGE_KEY = 'biases-checked'

export default function BiasesPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [needles, setNeedles] = useState<Record<string, Needle>>({})
  const [query, setQuery] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const [headerH, setHeaderH] = useState(0)

  // Keep content offset in sync with the fixed header's height (it grows when
  // the progress row wraps on small screens).
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setHeaderH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Load saved progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        setChecked(new Set(ids))
        setNeedles(Object.fromEntries(ids.map((id) => [id, makeNeedle(id)])))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]))
    } catch {}
  }, [checked, hydrated])

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      const isChecked = next.has(id)
      if (isChecked) next.delete(id)
      else next.add(id)
      setNeedles((pn) => {
        const nn = { ...pn }
        if (isChecked) delete nn[id]
        else nn[id] = makeNeedle(id)
        return nn
      })
      return next
    })
  }

  const reset = () => {
    setChecked(new Set())
    setNeedles({})
  }

  const needleList = useMemo(() => Object.values(needles), [needles])
  const count = checked.size

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        ...cat,
        biases: q
          ? cat.biases.filter(
              (b) =>
                b.name.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q)
            )
          : cat.biases,
      })).filter((cat) => cat.biases.length > 0),
    [q]
  )

  return (
    <div className="biases-page min-h-screen bg-[#13131f] text-slate-100">
      {/* Fixed doll + progress */}
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#13131f]/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-3">
          <div className="shrink-0">
            <VoodooDoll needles={needleList} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              The Cognitive Bias Checklist
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Tick every bias you catch yourself in. The doll keeps score.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${(count / TOTAL_BIASES) * 100}%` }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-sm text-slate-300">
                {count}/{TOTAL_BIASES}
              </span>
              {count > 0 && (
                <button
                  onClick={reset}
                  className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6" style={{ paddingTop: headerH + 24 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter biases…"
          className="mb-8 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-400/60 focus:outline-none"
        />

        {filtered.map((cat) => (
          <section key={cat.name} className="mb-10">
            <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-amber-300">
              {cat.name}
              <span className="text-xs font-normal text-slate-500">
                {cat.biases.filter((b) => checked.has(b.id)).length}/{cat.biases.length}
              </span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {cat.biases.map((b) => {
                const on = checked.has(b.id)
                return (
                  <li key={b.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                        on
                          ? 'border-rose-400/40 bg-rose-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(b.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-rose-500"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-medium ${
                            on ? 'text-rose-200' : 'text-slate-100'
                          }`}
                        >
                          {b.name}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-400">
                          {b.description}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            No biases match “{query}”.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          Biases sourced from Wikipedia’s{' '}
          <a
            href="https://en.wikipedia.org/wiki/List_of_cognitive_biases"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-400"
          >
            List of cognitive biases
          </a>
          . Progress is saved in your browser.
        </p>
      </main>
    </div>
  )
}
