'use client'

import { Dispatch, FormEvent, SetStateAction, useState } from 'react'
import { Actions, Button, Select } from '@/components/demo/controls'
import { toHex } from '@/lib/classic-ciphers'
import {
  FolioKeyError,
  SealedPost,
  derivePostKey,
  deriveTagKey,
  fromBase64Url,
  generateMasterSecret,
  issueKey,
  openKey,
  sealPost,
  toBase64Url,
  unsealPost
} from '@/lib/folio-crypto'

const SLUG = 'demo-message'
const TAGS = ['friends', 'family', 'work']
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface SealedState {
  sealed: SealedPost | null
  // The ciphertext as it is now, with any tampering
  body: Uint8Array | null
  original: Uint8Array | null
  // Per lock: a real lock, not a decoy
  real: boolean[]
  messageBytes: number
  sealTag: string | null
  key: { text: string; email: string; tag: string } | null
  unseal: 'none' | 'ok' | 'failed'
  last: 'created' | 'seal' | 'issue' | 'unseal' | 'tamper'
}

export const initialSealed: SealedState = {
  sealed: null,
  body: null,
  original: null,
  real: [],
  messageBytes: 0,
  sealTag: null,
  key: null,
  unseal: 'none',
  last: 'created'
}

interface SealedMessageProps {
  state: SealedState
  onChange: Dispatch<SetStateAction<SealedState>>
  // crypto.subtle exists (it does not on an insecure origin)
  available: boolean
}

// Which locks are real: a real lock is one whose removal stops a single matching key from opening the post
async function findRealLocks(sealed: SealedPost, master: Uint8Array, tag: string): Promise<boolean[]> {
  const grants = [
    { tags: new Map([[tag, await deriveTagKey(master, tag)]]), posts: new Map<string, Uint8Array>() },
    { tags: new Map<string, Uint8Array>(), posts: new Map([[SLUG, await derivePostKey(master, SLUG)]]) }
  ]
  const real: boolean[] = []
  for (let index = 0; index < sealed.locks.length; index += 1) {
    const without = { ...sealed, locks: sealed.locks.filter((_, other) => other !== index) }
    const opens = await Promise.all(grants.map(grant => unsealPost(without, grant)))
    real.push(opens.some(plain => plain === null))
  }
  return real
}

const shorten = (text: string) => (text.length > 44 ? `${text.slice(0, 44)}...` : text)

export function SealedMessage({ state, onChange, available }: SealedMessageProps) {
  // Held in this tab's memory only. It is never stored, shown or logged.
  const [master] = useState(() => (available ? generateMasterSecret() : null))
  const [message, setMessage] = useState('Meet me by the old stone bridge.')
  const [tag, setTag] = useState(TAGS[0])
  const [email, setEmail] = useState('reader@example.com')
  const [errors, setErrors] = useState<{ seal?: string; issue?: string; unseal?: string }>({})
  const [outcome, setOutcome] = useState<string | null>(null)

  const ciphertext = state.body

  const seal = async (event: FormEvent) => {
    event.preventDefault()
    if (!master) return
    if (!message.trim()) return setErrors({ seal: 'Write a message to seal first.' })
    const plaintext = encoder.encode(message)
    try {
      const sealed = await sealPost({ masterSecret: master, slug: SLUG, tagSlugs: [tag], plaintext })
      const body = fromBase64Url(sealed.body)
      const real = await findRealLocks(sealed, master, tag)
      setErrors({})
      setOutcome(null)
      onChange(s => ({
        ...s,
        sealed,
        body,
        original: body,
        real,
        messageBytes: plaintext.length,
        unseal: 'none',
        last: 'seal',
        sealTag: tag
      }))
    } catch {
      setErrors({ seal: 'Sealing failed. Press Seal to try again.' })
    }
  }

  const issue = async (event: FormEvent) => {
    event.preventDefault()
    if (!master) return
    if (!email.includes('@')) return setErrors(e => ({ ...e, issue: 'Enter an email address to issue the key to.' }))
    try {
      const text = await issueKey({ masterSecret: master, email, tags: [tag], label: 'demo key' })
      setErrors(e => ({ ...e, issue: undefined }))
      onChange(s => ({ ...s, key: { text, email, tag }, last: 'issue' }))
    } catch {
      setErrors(e => ({ ...e, issue: 'Issuing failed. Press Issue a key to try again.' }))
    }
  }

  const unseal = async (event: FormEvent) => {
    event.preventDefault()
    const { sealed, body, key } = state
    const fail = (text: string) => {
      setErrors(e => ({ ...e, unseal: text }))
      setOutcome(null)
      onChange(s => ({ ...s, unseal: 'failed', last: 'unseal' }))
    }
    if (!sealed || !body) return setErrors(e => ({ ...e, unseal: 'Seal a message first.' }))
    if (!key) return setErrors(e => ({ ...e, unseal: 'Issue a key first.' }))
    let grants
    try {
      grants = await openKey(key.text, email)
    } catch (error) {
      return fail(error instanceof FolioKeyError ? error.message : 'The key could not be read.')
    }
    try {
      const plain = await unsealPost({ ...sealed, body: toBase64Url(body) }, grants)
      if (!plain) return fail('This key does not open this message.')
      setErrors(e => ({ ...e, unseal: undefined }))
      setOutcome(decoder.decode(plain))
      onChange(s => ({ ...s, unseal: 'ok', last: 'unseal' }))
    } catch (error) {
      const altered = state.original && body.some((byte, index) => byte !== state.original![index])
      fail(altered ? 'Authentication failed. The ciphertext was altered.' : error instanceof Error ? error.message : 'Unsealing failed.')
    }
  }

  // Flip the lowest bit of one byte; clicking it again puts it back
  const tamper = (index: number) => {
    onChange(s => {
      if (!s.body) return s
      const body = s.body.slice()
      body[index] ^= 1
      return { ...s, body, last: 'tamper', unseal: 'none' }
    })
    setOutcome(null)
    setErrors(e => ({ ...e, unseal: undefined }))
  }

  if (!available) {
    return <p role="status">This browser does not expose crypto.subtle on an insecure origin, so sealing is turned off here. Open this page over HTTPS or on localhost.</p>
  }

  return (
    <div className="crypto-sealed">
      <p>A demo master secret was created in this tab. It is discarded when you leave.</p>
      <Select label="Tag" value={tag} options={TAGS.map(value => ({ value, label: value }))} onChange={setTag} />

      <form className="crypto-form" onSubmit={seal}>
        <label htmlFor="crypto-seal-message">Message to seal</label>
        <input id="crypto-seal-message" className="crypto-input" type="text" maxLength={80} value={message} onChange={event => setMessage(event.target.value)} autoComplete="off" />
        <Actions>
          <Button type="submit" variant="primary">
            Seal
          </Button>
          {errors.seal && (
            <span role="alert" data-signal="change">
              {errors.seal}
            </span>
          )}
        </Actions>
      </form>

      {state.sealed && ciphertext && (
        <div className="crypto-result">
          <p className="crypto-label">Sealed for the tag {state.sealTag}. Ciphertext, {ciphertext.length} bytes. Click a byte to change it.</p>
          <div className="crypto-bytes" role="group" aria-label="Ciphertext bytes">
            {Array.from(ciphertext, (byte, index) => {
              const changed = byte !== state.original?.[index]
              return (
                <button key={index} type="button" className="crypto-byte" data-signal={changed ? 'change' : undefined} aria-label={`Byte ${index + 1}, ${byte.toString(16).padStart(2, '0')}${changed ? ', changed' : ''}. Press to flip its lowest bit.`} onClick={() => tamper(index)}>
                  {byte.toString(16).padStart(2, '0')}
                </button>
              )
            })}
          </div>
          <p className="crypto-label">
            The message is compressed, then encrypted with AES-GCM under a random content key. The last 16 bytes are the authentication tag.
          </p>
          <p>
            <span className="crypto-label">Nonce</span> <code>{toHex(fromBase64Url(state.sealed.nonce))}</code>
          </p>
          <p className="crypto-label">
            Locks: {state.sealed.locks.length} ({state.real.filter(Boolean).length} real, {state.real.filter(real => !real).length} decoy)
          </p>
          <ul className="crypto-locks">
            {state.sealed.locks.map((lock, index) => (
              <li key={lock.lid}>
                <code>{lock.lid}</code> {state.real[index] ? 'real lock' : 'decoy'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="crypto-form" onSubmit={issue}>
        <label htmlFor="crypto-email">Email to issue the key to</label>
        <input id="crypto-email" className="crypto-input" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" />
        <Actions>
          <Button type="submit">Issue a key</Button>
          {errors.issue && (
            <span role="alert" data-signal="change">
              {errors.issue}
            </span>
          )}
        </Actions>
      </form>
      {state.key && (
        <p>
          <span className="crypto-label">Demo key for {state.key.tag}</span> <code>{shorten(state.key.text)}</code>
        </p>
      )}

      <form className="crypto-form" onSubmit={unseal}>
        <Actions>
          <Button type="submit">Unseal</Button>
          {errors.unseal && (
            <span role="alert" data-signal="change">
              {errors.unseal}
            </span>
          )}
        </Actions>
      </form>
      {outcome !== null && <p role="status">Unsealed: {outcome}</p>}
    </div>
  )
}
