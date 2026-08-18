'use client'

import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { MDXRemote } from 'next-mdx-remote'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import { mdxClientComponents } from '@/components/mdx/mdx-client-components'
import { FolioKeyError, openKey, unsealPost } from '@/lib/folio-crypto'
import type { SealedPost, UnlockGrants } from '@/lib/folio-crypto'

interface LockedPostProps {
  slug: string
}

interface StoredCredential {
  key: string
  email: string
}

type LockedPostPhase = 'checking' | 'form' | 'unlocked'

// Versioned so a future change to the stored shape can be rolled out without
// crashing on a reader's old sessionStorage entry — it just misses the version
// and falls back to the form.
const STORAGE_KEY = 'folio:reader-key:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSealedPostShape(value: unknown): value is SealedPost {
  return (
    isRecord(value) &&
    typeof value.v === 'number' &&
    typeof value.slug === 'string' &&
    typeof value.nonce === 'string' &&
    typeof value.body === 'string' &&
    Array.isArray(value.locks)
  )
}

function sealedPostUrl(slug: string): string {
  // No basePath is configured for this export (see next.config.js), so an
  // absolute path matches every other public asset reference in this app.
  return `/blog-enc/${slug}.json`
}

function readStoredCredential(): StoredCredential | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)

    if (isRecord(parsed) && typeof parsed.key === 'string' && typeof parsed.email === 'string') {
      return { key: parsed.key, email: parsed.email }
    }
  } catch {
    // Malformed storage is treated the same as no stored credential.
  }

  return null
}

function storeCredential(credential: StoredCredential) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
}

function clearStoredCredential() {
  window.sessionStorage.removeItem(STORAGE_KEY)
}

export function LockedPost({ slug }: LockedPostProps) {
  const [phase, setPhase] = useState<LockedPostPhase>('checking')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mdxResult, setMdxResult] = useState<MDXRemoteSerializeResult | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [emailInput, setEmailInput] = useState('')

  const unlock = useCallback(
    async (key: string, email: string) => {
      setPhase('checking')
      setErrorMessage(null)

      let grants: UnlockGrants

      try {
        grants = await openKey(key, email)
      } catch (error) {
        // A key/email pair that does not even open is not worth keeping around.
        clearStoredCredential()
        setPhase('form')
        setErrorMessage(
          error instanceof FolioKeyError ? error.message : 'That reader key could not be read.'
        )
        return
      }

      // The pair is valid on its own merits, independent of this particular
      // post, so it is safe to remember even if the steps below fail.
      storeCredential({ key, email })

      let response: Response

      try {
        response = await fetch(sealedPostUrl(slug))
      } catch {
        setPhase('form')
        setErrorMessage(
          'Could not reach the server to fetch this post. Check your connection and try again.'
        )
        return
      }

      if (response.status === 404) {
        setPhase('form')
        setErrorMessage('This post has not been published in encrypted form yet.')
        return
      }

      if (!response.ok) {
        setPhase('form')
        setErrorMessage(`Could not fetch the encrypted post (server responded ${response.status}).`)
        return
      }

      let sealed: SealedPost

      try {
        const body: unknown = await response.json()

        if (!isSealedPostShape(body)) {
          throw new Error('Unexpected sealed post shape.')
        }

        sealed = body
      } catch {
        setPhase('form')
        setErrorMessage('The encrypted post artifact is corrupt or in an unexpected format.')
        return
      }

      let plaintext: Uint8Array | null

      try {
        plaintext = await unsealPost(sealed, grants)
      } catch (error) {
        setPhase('form')
        setErrorMessage(
          error instanceof FolioKeyError
            ? error.message
            : 'The encrypted post could not be decrypted.'
        )
        return
      }

      if (!plaintext) {
        setPhase('form')
        setErrorMessage('This key does not grant access to this post.')
        return
      }

      try {
        const decoded: unknown = JSON.parse(new TextDecoder().decode(plaintext))

        if (!isRecord(decoded) || typeof decoded.compiledSource !== 'string') {
          throw new Error('Unexpected decrypted post shape.')
        }

        setMdxResult(decoded as unknown as MDXRemoteSerializeResult)
        setPhase('unlocked')
      } catch {
        setPhase('form')
        setErrorMessage('The decrypted post is corrupt and could not be rendered.')
      }
    },
    [slug]
  )

  useEffect(() => {
    const stored = readStoredCredential()

    if (!stored) {
      setPhase('form')
      return
    }

    void unlock(stored.key, stored.email)
  }, [unlock])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void unlock(keyInput.trim(), emailInput.trim())
  }

  function handleLockAgain() {
    clearStoredCredential()
    setMdxResult(null)
    setKeyInput('')
    setEmailInput('')
    setErrorMessage(null)
    setPhase('form')
  }

  if (phase === 'unlocked' && mdxResult) {
    return (
      <div className="locked-post-unlocked">
        <div className="locked-post-unlocked-bar">
          <button
            type="button"
            className="blog-quiz-button blog-quiz-button-secondary"
            onClick={handleLockAgain}>
            Lock again
          </button>
        </div>
        <div className="blog-prose">
          <MDXRemote {...mdxResult} components={mdxClientComponents} />
        </div>
      </div>
    )
  }

  return (
    <div className="locked-post">
      <p className="locked-post-copy">
        This post is encrypted — enter the reader key and the email address it was issued to
        and it will unlock in your browser.
      </p>

      {phase === 'checking' ? (
        <p className="locked-post-status">Checking for a saved key…</p>
      ) : null}

      {errorMessage ? <p className="locked-post-error">{errorMessage}</p> : null}

      <form className="locked-post-form" onSubmit={handleSubmit}>
        <label className="locked-post-field" htmlFor={`${slug}-locked-post-key`}>
          Reader key
          <input
            id={`${slug}-locked-post-key`}
            className="blog-filter-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="folio1_..."
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            required
          />
        </label>

        <label className="locked-post-field" htmlFor={`${slug}-locked-post-email`}>
          Email
          <input
            id={`${slug}-locked-post-email`}
            className="blog-filter-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            required
          />
        </label>

        <div className="locked-post-actions">
          <button type="submit" className="blog-quiz-button" disabled={phase === 'checking'}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}
