'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ScrollLayout, useDemoShell } from '@/components/demo/DemoShell'
import { Ledger, LedgerRow } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Actions, Button, Segmented } from '@/components/demo/controls'
import { bitDifference, shannonEntropy } from '@/lib/classic-ciphers'
import { loadWasm, WasmExports } from '@/lib/wasm'
import { AvalancheWall } from './AvalancheWall'
import { Benchmark } from './Benchmark'
import { ClassicCiphers, CipherState, FrequencyChart, initialCipher } from './ClassicCiphers'
import { KeyTree, TreeNode } from './KeyTree'
import { SealedMessage, SealedState, initialSealed } from './SealedMessage'
import './crypto.css'

type Algo = 'sha256' | 'crc32' | 'fnv1a' | 'djb2'
type Match = 'match' | 'differ' | 'pending' | 'rust-missing' | 'browser-missing'
type WasmState = 'loading' | 'ready' | 'missing'

interface HashView {
  text: string
  algo: Algo
  bytes: Uint8Array
  bits: Uint8Array
  // 1 where a bit differs from the previous digest
  changed: Uint8Array
  // Null until there is a previous digest of the same algorithm to compare with
  count: number | null
  generation: number
  match: Match
}

const MESSAGE = 'the quick brown fox'
const ALGOS: { value: Algo; label: string }[] = [
  { value: 'sha256', label: 'SHA-256' },
  { value: 'crc32', label: 'CRC32' },
  { value: 'fnv1a', label: 'FNV-1a' },
  { value: 'djb2', label: 'djb2' }
]
const STEPS = ['A hash', 'A sealed message', 'Ciphers that do not work']
const encoder = new TextEncoder()

const noSubscribe = () => () => {}
const hasSubtle = () => typeof crypto !== 'undefined' && !!crypto.subtle

const bigEndian = (value: number) => new Uint8Array([value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
const toBits = (bytes: Uint8Array) => Uint8Array.from(Array.from(bytes, byte => Array.from({ length: 8 }, (_, bit) => (byte >> (7 - bit)) & 1)).flat())

async function digestOf(text: string, algo: Algo, wasm: WasmExports | null, wasmState: WasmState): Promise<{ bytes: Uint8Array; match: Match }> {
  const data = encoder.encode(text)
  if (algo !== 'sha256') {
    if (!wasm) throw new Error('The Rust build is not loaded.')
    const value = algo === 'crc32' ? wasm.crc32(data) : algo === 'fnv1a' ? wasm.fnv1a_hash(text) : wasm.simple_hash(text)
    return { bytes: bigEndian(value >>> 0), match: 'pending' }
  }
  const rust = wasm ? wasm.sha256(data) : null
  const browser = hasSubtle() ? new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource)) : null
  const bytes = rust ?? browser
  if (!bytes) throw new Error('SHA-256 is not available in this browser.')
  const match: Match = !rust ? (wasmState === 'loading' ? 'pending' : 'rust-missing') : !browser ? 'browser-missing' : bitDifference(rust, browser) === 0 ? 'match' : 'differ'
  return { bytes, match }
}

// Loads the Rust build and hashes on request. Each call compares with the digest before it.
function useHash() {
  const wasm = useRef<WasmExports | null>(null)
  const status = useRef<WasmState>('loading')
  const sequence = useRef(0)
  const latest = useRef<HashView | null>(null)
  const [view, setView] = useState<HashView | null>(null)
  const [wasmState, setWasmState] = useState<WasmState>('loading')
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(async (text: string, algo: Algo, compare = true) => {
    const id = ++sequence.current
    let out
    try {
      out = await digestOf(text, algo, wasm.current, status.current)
    } catch (failure) {
      if (id === sequence.current) setError(failure instanceof Error ? failure.message : 'Hashing failed.')
      return
    }
    if (id !== sequence.current) return
    const old = latest.current
    const bits = toBits(out.bytes)
    let next: HashView
    if (compare) {
      const before = old && old.algo === algo ? old : null
      next = {
        text,
        algo,
        bytes: out.bytes,
        bits,
        changed: before ? bits.map((bit, index) => (bit !== before.bits[index] ? 1 : 0)) : new Uint8Array(bits.length),
        count: before ? bitDifference(before.bytes, out.bytes) : null,
        generation: (old?.generation ?? 0) + 1,
        match: out.match
      }
    } else if (old) {
      next = { ...old, match: out.match }
    } else {
      return
    }
    latest.current = next
    setError(null)
    setView(next)
  }, [])

  const track = useCallback(
    (loading: Promise<WasmExports>) => {
      loading
        .then(loaded => {
          wasm.current = loaded
          status.current = 'ready'
          setWasmState('ready')
        })
        .catch(() => {
          status.current = 'missing'
          setWasmState('missing')
        })
        .then(() => {
          const current = latest.current
          if (current) apply(current.text, current.algo, false)
        })
    },
    [apply]
  )

  useEffect(() => track(loadWasm()), [track])

  const retry = () => {
    status.current = 'loading'
    setWasmState('loading')
    track(loadWasm())
  }

  return { view, apply, wasmState, retry, error }
}

function matchText(match: Match): ReactNode {
  if (match === 'match') return '✓ matches'
  if (match === 'differ') return <span data-signal="change">differs</span>
  if (match === 'pending') return 'checking'
  if (match === 'browser-missing') return 'crypto.subtle unavailable'
  return 'Rust build unavailable'
}

const percent = (count: number, total: number) => `${((count / total) * 100).toFixed(1)}%`

// Crossfades its layers over 240 ms; only the active one can be read or focused
function Visual({ step, layers }: { step: number; layers: ReactNode[] }) {
  return (
    <div className="crypto-visual">
      {layers.map((layer, index) => (
        <div key={index} className="crypto-layer" data-active={index === step}>
          {layer}
        </div>
      ))}
    </div>
  )
}

export function Cryptography() {
  const { setReady, reducedMotion } = useDemoShell()
  const subtle = useSyncExternalStore(noSubscribe, hasSubtle, () => true)
  const { view, apply, wasmState, retry, error } = useHash()
  const [message, setMessage] = useState('')
  const [algo, setAlgo] = useState<Algo>('sha256')
  const [note, setNote] = useState<string | null>(null)
  const [sealed, setSealed] = useState(initialSealed)
  const [cipher, setCipher] = useState<CipherState>(initialCipher)
  const [step, setStep] = useState(0)
  const typing = useRef(0)
  const column = useRef<HTMLDivElement | null>(null)

  useEffect(() => setReady(), [setReady])

  // The entrance: the empty digest, then the message types itself in over a second
  useEffect(() => {
    let cancelled = false
    let delay = 0
    apply('', 'sha256').then(() => {
      if (cancelled) return
      if (reducedMotion) {
        setMessage(MESSAGE)
        apply(MESSAGE, 'sha256')
        return
      }
      delay = window.setTimeout(() => {
        let length = 0
        typing.current = window.setInterval(() => {
          length += 1
          const text = MESSAGE.slice(0, length)
          setMessage(text)
          apply(text, 'sha256')
          if (length >= MESSAGE.length) window.clearInterval(typing.current)
        }, 1000 / MESSAGE.length)
      }, 300)
    })
    return () => {
      cancelled = true
      window.clearTimeout(delay)
      window.clearInterval(typing.current)
    }
  }, [apply, reducedMotion])

  // The step in view is the last heading above the middle of the viewport
  useEffect(() => {
    const headings = Array.from(column.current?.querySelectorAll<HTMLElement>('[data-step]') ?? [])
    const update = () => {
      const above = headings.filter(heading => heading.getBoundingClientRect().top <= window.innerHeight / 2)
      setStep(Math.max(0, above.length - 1))
    }
    const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -50% 0px', threshold: [0, 1] })
    headings.forEach(heading => observer.observe(heading))
    update()
    return () => observer.disconnect()
  }, [])

  const edit = (text: string, next = algo) => {
    window.clearInterval(typing.current)
    setMessage(text)
    apply(text, next)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    window.clearInterval(typing.current)
    apply(message, algo)
  }

  const choose = (next: Algo) => {
    window.clearInterval(typing.current)
    setAlgo(next)
    setNote(null)
    apply(message, next)
  }

  // Flips one bit of one ASCII character, keeping the result printable
  const flipBit = () => {
    const chars = Array.from(message)
    const options: [number, number][] = []
    chars.forEach((char, index) => {
      const code = char.codePointAt(0) ?? 0
      if (code >= 128) return
      for (let bit = 0; bit < 7; bit += 1) if ((code ^ (1 << bit)) >= 32 && (code ^ (1 << bit)) < 127) options.push([index, bit])
    })
    if (!options.length) return setNote('Nothing to flip. Type some plain text first.')
    const [index, bit] = options[Math.floor(Math.random() * options.length)]
    chars[index] = String.fromCharCode(chars[index].charCodeAt(0) ^ (1 << bit))
    setNote(`Flipped bit ${bit} of character ${index + 1}. Bit 0 is the lowest.`)
    edit(chars.join(''))
  }

  const checksum = algo !== 'sha256'
  const total = view?.bits.length ?? 256
  const label = ALGOS.find(option => option.value === algo)?.label ?? ''
  const entropy = `${shannonEntropy(message).toFixed(1)} bits per character`
  const hex = view ? Array.from(view.bytes, byte => byte.toString(16).padStart(2, '0')).join('') : ''
  const counter = view?.count == null ? 'Edit the message to flip bits' : `${view.count} of ${total} bits changed`

  const hashRows: LedgerRow[] = [
    { key: 'Bits changed', value: view?.count == null ? '—' : `${view.count} of ${total}` },
    ...(checksum ? [] : [{ key: 'Digest matches the browser’s', value: view ? matchText(view.match) : '—' }]),
    { key: 'Entropy', value: entropy }
  ]

  const locks = sealed.sealed ? `${sealed.sealed.locks.length} (${sealed.real.filter(Boolean).length} real, ${sealed.real.filter(real => !real).length} decoy)` : '—'
  const altered = !!sealed.body && !!sealed.original && sealed.body.some((byte, index) => byte !== sealed.original![index])
  const sealRows: LedgerRow[] = [
    { key: 'Message bytes', value: sealed.sealed ? sealed.messageBytes : '—' },
    { key: 'Ciphertext bytes', value: sealed.body ? sealed.body.length : '—' },
    { key: 'Locks', value: locks },
    { key: 'Last unseal', value: sealed.unseal === 'none' ? '—' : sealed.unseal === 'ok' ? 'ok' : 'failed', signal: sealed.unseal === 'failed' ? 'change' : undefined }
  ]

  const cipherKey = cipher.active === 'Caesar' ? `shift ${cipher.shift}` : cipher.active === 'Substitution' ? cipher.subKey : cipher.xorKey
  const cipherRows: LedgerRow[] = [
    { key: 'Cipher', value: cipher.active },
    { key: 'Key', value: cipherKey || '—' },
    { key: 'Broken in', value: cipher.brokenMs === null ? '—' : `${(cipher.brokenMs / 1000).toFixed(1)} s` }
  ]

  const created: TreeNode[] = ['master']
  const made: TreeNode[] = ['master', 'hkdfTag', 'hkdfPost', 'tagKey', 'postKey', 'content', 'aes', 'cipher']
  const used: Record<SealedState['last'], TreeNode[]> = {
    created: ['master'],
    seal: ['content', 'aes', 'cipher'],
    issue: ['hkdfTag', 'tagKey'],
    unseal: ['content', 'aes', 'cipher'],
    tamper: ['cipher']
  }

  const layers = [
    <>
      <figure className="crypto-figure">
        {view && <AvalancheWall bits={view.bits} changed={reducedMotion ? null : view.changed} generation={view.generation} label={label} />}
        <figcaption>
          {view?.count == null ? counter : `${counter}  ${percent(view.count, total)}`}
          <span className="demo-visually-hidden">{` ${label} digest ${hex}`}</span>
        </figcaption>
      </figure>
      <Ledger placement="inline" rows={hashRows} label="Hash readouts" />
    </>,
    <>
      <figure className="crypto-figure">
        <KeyTree lit={sealed.sealed ? made : created} active={used[sealed.last]} altered={altered} />
      </figure>
      <Ledger placement="inline" rows={sealRows} label="Sealed message readouts" />
    </>,
    <>
      <figure className="crypto-figure">
        <FrequencyChart state={cipher} />
      </figure>
      <Ledger placement="inline" rows={cipherRows} label="Cipher readouts" />
    </>
  ]

  return (
    <>
      <ScrollLayout visual={<Visual step={step} layers={layers} />}>
        <div ref={column} className="crypto-column">
          <h2 data-step="0">1 {STEPS[0]}</h2>
          <p>A hash turns any message into a fixed-size digest. Change one character and about half of the 256 bits of a SHA-256 digest change, which is why the wall keeps flipping.</p>
          <form className="crypto-form" onSubmit={submit}>
            <label htmlFor="crypto-message">Message</label>
            <input id="crypto-message" className="crypto-input" type="text" value={message} onChange={event => edit(event.target.value)} autoComplete="off" spellCheck={false} />
            <p className="crypto-label">{entropy}</p>
          </form>
          <Segmented
            label="Hash"
            value={algo}
            options={wasmState === 'ready' ? ALGOS : ALGOS.slice(0, 1)}
            onChange={choose}
          />
          {wasmState === 'missing' && (
            <Actions>
              <span>Rust build unavailable, so the checksums are hidden.</span>
              <Button onClick={retry}>Retry</Button>
            </Actions>
          )}
          <Actions>
            <Button onClick={flipBit}>Flip one bit</Button>
            {note && <span role="status">{note}</span>}
          </Actions>
          {error && (
            <p role="alert" data-signal="change">
              {error}
            </p>
          )}
          {view && (
            <p className="crypto-digest">
              <span className="crypto-label">{checksum ? `${label}, a checksum and not a hash function` : 'SHA-256'}</span>
              <code>{hex.match(/.{1,32}/g)?.join('\n')}</code>
              {!checksum && (
                <span className="crypto-label">
                  {view.match === 'rust-missing' ? 'Rust build unavailable' : <>Rust sha2 against the browser’s crypto.subtle: {matchText(view.match)}</>}
                </span>
              )}
            </p>
          )}
          <p>
            A checksum catches accidents. It is not built to resist anyone, so it can move far fewer bits than half. Pick one above, edit the last character and compare. A single edit of SHA-256 changes a number of bits spread around 128 with a standard deviation of 8, so 100 or 150 turns up now and then.
          </p>
          <h3>How fast is SHA-256?</h3>
          <p>The same random buffer goes through Rust, hand-written JavaScript and the browser. All three digests must match. It runs in a worker when you press the button.</p>
          <Benchmark />

          <h2 data-step="1">2 {STEPS[1]}</h2>
          <p>This is the scheme that locks some posts on this blog. Press Seal to encrypt a message, issue a key for a tag and unseal with it. Then change one byte of the ciphertext and unseal again.</p>
          <SealedMessage state={sealed} onChange={setSealed} available={subtle} />
          <p className="crypto-label">Keys made here are demo keys. They start with folio1_ because the library fixes that prefix, and they open nothing on the blog.</p>

          <h2 data-step="2">3 {STEPS[2]}</h2>
          <p>Three old ciphers, all weak. Caesar slides every letter along the alphabet. Substitution swaps each letter for another. XOR combines the message with a repeating key. Break the Caesar cipher to see why the first one fails: English letters are not equally common, and a shift keeps that pattern.</p>
          <ClassicCiphers state={cipher} onChange={setCipher} />
        </div>
      </ScrollLayout>
      <Notes slug="crypto">
        <NotesSection title="What you are looking at">
          <p>The scheme that locks some posts on this blog, running in your browser with a throwaway secret. Step 2 calls the same code the blog does.</p>
        </NotesSection>
        <NotesSection title="How it works">
          <p>Step 1 hashes your message with SHA-256 twice, once in Rust through the sha2 crate and once with the browser’s crypto.subtle, and ticks when the digests match. CRC32, FNV-1a and djb2 run in Rust and are checksums, not hash functions. Entropy is Shannon entropy over Unicode code points.</p>
          <p>Step 2 derives a tag key and a post key from a master secret with HKDF-SHA-256. Each post has its own random content key, so the key that opens one post is never the key to another. That key is wrapped once per way of unlocking the post, here the post key and the tag key, so any one of them recovers it without sharing the others. Decoy locks pad the count to eight, so nobody can tell how many tags a post has. The body is encrypted with AES-GCM, which also detects changes: alter one byte and unsealing fails instead of returning garbage.</p>
          <p>Step 3 holds three classical ciphers. Caesar is broken by trying all 26 shifts and keeping the one whose letter frequencies are closest to English. The scan is slowed so you can watch it.</p>
          <p>The master secret here comes from crypto.getRandomValues in this tab and is never stored. The real one lives outside the repositories and never enters a build, so nothing made on this page can open a real post.</p>
        </NotesSection>
        <NotesSection title="What this is not">
          <p>Nothing here is a tutorial on building your own cryptography. The ciphers in step 3 are broken on purpose. For real work, use crypto.subtle. This blog does.</p>
        </NotesSection>
        <NotesSource files={['src/lib/folio-crypto.ts', 'wasm/src/crypto.rs']} />
      </Notes>
    </>
  )
}
