'use client'

import { Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from 'react'
import { useDemoShell } from '@/components/demo/DemoShell'
import { Actions, Button, Slider } from '@/components/demo/controls'
import {
  ENGLISH_FREQUENCIES,
  breakCaesar,
  caesarDecrypt,
  caesarEncrypt,
  isSubstitutionKey,
  letterFrequencies,
  substitutionDecrypt,
  substitutionEncrypt,
  toHex,
  xorDecrypt,
  xorEncrypt
} from '@/lib/classic-ciphers'

export type CipherName = 'Caesar' | 'Substitution' | 'XOR'

export interface CipherState {
  active: CipherName
  shift: number
  // The last ciphertext of each cipher, which its Decrypt uses
  caesar: string
  substitution: string
  xor: Uint8Array
  subKey: string
  xorKey: string
  brokenMs: number | null
}

const MESSAGE = 'Meet me by the old stone bridge at first light, and bring the map, the lantern and a little bread.'
const SUB_KEY = 'QWERTYUIOPASDFGHJKLZXCVBNM'
const XOR_KEY = 'folio'
const SCAN_MS = 36

export const initialCipher: CipherState = {
  active: 'Caesar',
  shift: 3,
  caesar: caesarEncrypt(MESSAGE, 3),
  substitution: substitutionEncrypt(MESSAGE, SUB_KEY),
  xor: xorEncrypt(MESSAGE, XOR_KEY),
  subKey: SUB_KEY,
  xorKey: XOR_KEY,
  brokenMs: null
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BASELINE = 176
const TOP = 16

/** Letter shares in the last ciphertext as bars, English as outlines. For Caesar the outlines sit at the shift being tried. */
export function FrequencyChart({ state }: { state: CipherState }) {
  if (state.active === 'XOR') {
    return <p className="crypto-chart-empty">XOR turns letters into arbitrary bytes, so there is no letter pattern to chart.</p>
  }
  const bars = letterFrequencies(state.active === 'Caesar' ? state.caesar : state.substitution)
  const shift = state.active === 'Caesar' ? state.shift : 0
  const english = LETTERS.split('').map((_, index) => ENGLISH_FREQUENCIES[(index - shift + 26) % 26] / 100)
  const scale = (BASELINE - TOP) / Math.max(...bars, ...english)
  return (
    <svg className="crypto-chart" viewBox="0 0 520 210" role="img" aria-label={`Letter frequencies of the ${state.active} ciphertext as bars, with English letter frequencies as outlines`}>
      {LETTERS.split('').map((letter, index) => {
        const x = 10 + index * 19.5
        return (
          <g key={letter}>
            <rect className="crypto-outline" x={x} width="14" style={{ y: BASELINE - english[index] * scale, height: english[index] * scale }} />
            <rect className="crypto-bar" x={x + 3} width="8" style={{ y: BASELINE - bars[index] * scale, height: bars[index] * scale }} />
            <text className="crypto-letter" x={x + 7} y={BASELINE + 16} textAnchor="middle">
              {letter}
            </text>
          </g>
        )
      })}
      <line className="crypto-axis" x1="6" x2="514" y1={BASELINE} y2={BASELINE} />
    </svg>
  )
}

interface ClassicCiphersProps {
  state: CipherState
  onChange: Dispatch<SetStateAction<CipherState>>
}

const Problem = ({ text }: { text?: string }) =>
  text ? (
    <span role="alert" data-signal="change">
      {text}
    </span>
  ) : null

export function ClassicCiphers({ state, onChange }: ClassicCiphersProps) {
  const { reducedMotion } = useDemoShell()
  const [messages, setMessages] = useState({ caesar: MESSAGE, substitution: MESSAGE, xor: MESSAGE })
  const [results, setResults] = useState<Partial<Record<CipherName, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<CipherName, string>>>({})
  const [scanning, setScanning] = useState(false)
  const [candidate, setCandidate] = useState('')
  const [computeMs, setComputeMs] = useState<number | null>(null)
  const timer = useRef(0)

  useEffect(() => () => window.clearInterval(timer.current), [])

  const patch = (partial: Partial<CipherState>) => onChange(s => ({ ...s, ...partial }))
  const say = (name: CipherName, result?: string, error?: string) => {
    setResults(r => ({ ...r, [name]: result }))
    setErrors(e => ({ ...e, [name]: error }))
  }
  const typed = (name: 'caesar' | 'substitution' | 'xor', value: string) => setMessages(m => ({ ...m, [name]: value }))

  const encryptCaesar = (event: FormEvent) => {
    event.preventDefault()
    patch({ active: 'Caesar', caesar: caesarEncrypt(messages.caesar, state.shift), brokenMs: null })
    say('Caesar')
  }

  const decryptCaesar = () => {
    patch({ active: 'Caesar' })
    say('Caesar', caesarDecrypt(state.caesar, state.shift))
  }

  const breakIt = () => {
    const started = performance.now()
    const { shift: best } = breakCaesar(state.caesar)
    setComputeMs(performance.now() - started)
    say('Caesar')
    const land = () => {
      window.clearInterval(timer.current)
      patch({ shift: best, brokenMs: performance.now() - started })
      say('Caesar', `Shift ${best}. ${caesarDecrypt(state.caesar, best)}`)
      setScanning(false)
    }
    patch({ active: 'Caesar', brokenMs: null })
    if (reducedMotion) return land()
    // Every shift is shown, the answer last
    const order = [...Array.from({ length: 26 }, (_, shift) => shift).filter(shift => shift !== best), best]
    let step = 0
    setScanning(true)
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      const shift = order[step]
      step += 1
      patch({ shift })
      setCandidate(caesarDecrypt(state.caesar, shift))
      if (step === order.length) land()
    }, SCAN_MS)
  }

  const encryptSubstitution = (event: FormEvent) => {
    event.preventDefault()
    if (!isSubstitutionKey(state.subKey)) return say('Substitution', undefined, 'The key needs each of the 26 letters exactly once.')
    patch({ active: 'Substitution', substitution: substitutionEncrypt(messages.substitution, state.subKey) })
    say('Substitution')
  }

  const decryptSubstitution = () => {
    if (!isSubstitutionKey(state.subKey)) return say('Substitution', undefined, 'The key needs each of the 26 letters exactly once.')
    patch({ active: 'Substitution' })
    say('Substitution', substitutionDecrypt(state.substitution, state.subKey))
  }

  const encryptXor = (event: FormEvent) => {
    event.preventDefault()
    if (!state.xorKey) return say('XOR', undefined, 'Enter a key to encrypt with.')
    patch({ active: 'XOR', xor: xorEncrypt(messages.xor, state.xorKey) })
    say('XOR')
  }

  const decryptXor = () => {
    if (!state.xorKey) return say('XOR', undefined, 'Enter a key to decrypt with.')
    patch({ active: 'XOR' })
    say('XOR', xorDecrypt(state.xor, state.xorKey))
  }

  return (
    <div className="crypto-ciphers">
      <form className="crypto-form" onSubmit={encryptCaesar}>
        <h3>Caesar</h3>
        <label htmlFor="crypto-caesar-message">Message</label>
        <input id="crypto-caesar-message" className="crypto-input" type="text" value={messages.caesar} onChange={event => typed('caesar', event.target.value)} autoComplete="off" />
        <Slider label="Shift" value={state.shift} min={0} max={25} defaultValue={3} onChange={shift => patch({ active: 'Caesar', shift })} disabled={scanning} />
        <Actions>
          <Button type="submit" disabled={scanning}>
            Encrypt
          </Button>
          <Button onClick={decryptCaesar} disabled={scanning}>
            Decrypt
          </Button>
          <Button onClick={breakIt} disabled={scanning}>
            Break it
          </Button>
          <Problem text={errors.Caesar} />
        </Actions>
        <p>
          <span className="crypto-label">Ciphertext</span> <code>{state.caesar}</code>
        </p>
        {scanning && (
          <p aria-hidden="true">
            <span className="crypto-label">Trying shift {state.shift}</span> <code>{candidate}</code>
          </p>
        )}
        {!scanning && results.Caesar !== undefined && (
          <p role="status">
            <span className="crypto-label">Decrypted</span> <code>{results.Caesar}</code>
          </p>
        )}
        {computeMs !== null && !scanning && state.brokenMs !== null && (
          <p className="crypto-label">
            Scoring all 26 shifts against English took {computeMs.toFixed(2)} ms. The scan is slowed so you can watch it.
          </p>
        )}
      </form>

      <form className="crypto-form" onSubmit={encryptSubstitution}>
        <h3>Substitution</h3>
        <label htmlFor="crypto-sub-message">Message</label>
        <input id="crypto-sub-message" className="crypto-input" type="text" value={messages.substitution} onChange={event => typed('substitution', event.target.value)} autoComplete="off" />
        <label htmlFor="crypto-sub-key">Key, the 26 letters in a new order</label>
        <input id="crypto-sub-key" className="crypto-input" type="text" value={state.subKey} maxLength={26} onChange={event => patch({ subKey: event.target.value })} autoComplete="off" spellCheck={false} />
        <Actions>
          <Button type="submit">Encrypt</Button>
          <Button onClick={decryptSubstitution}>Decrypt</Button>
          <Problem text={errors.Substitution} />
        </Actions>
        <p>
          <span className="crypto-label">Ciphertext</span> <code>{state.substitution}</code>
        </p>
        {results.Substitution !== undefined && (
          <p role="status">
            <span className="crypto-label">Decrypted</span> <code>{results.Substitution}</code>
          </p>
        )}
      </form>

      <form className="crypto-form" onSubmit={encryptXor}>
        <h3>XOR</h3>
        <label htmlFor="crypto-xor-message">Message</label>
        <input id="crypto-xor-message" className="crypto-input" type="text" value={messages.xor} onChange={event => typed('xor', event.target.value)} autoComplete="off" />
        <label htmlFor="crypto-xor-key">Key, repeated along the message</label>
        <input id="crypto-xor-key" className="crypto-input" type="text" value={state.xorKey} onChange={event => patch({ xorKey: event.target.value })} autoComplete="off" spellCheck={false} />
        <Actions>
          <Button type="submit">Encrypt</Button>
          <Button onClick={decryptXor}>Decrypt</Button>
          <Problem text={errors.XOR} />
        </Actions>
        <p>
          <span className="crypto-label">Ciphertext, hex</span> <code>{toHex(state.xor)}</code>
        </p>
        {results.XOR !== undefined && (
          <p role="status">
            <span className="crypto-label">Decrypted</span> <code>{results.XOR}</code>
          </p>
        )}
      </form>

      <p>Base64 is an encoding. It hides nothing.</p>
    </div>
  )
}
