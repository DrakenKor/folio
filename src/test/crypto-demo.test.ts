import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bitDifference, breakCaesar, caesarEncrypt, shannonEntropy } from '@/lib/classic-ciphers'
import { FolioKeyError, generateMasterSecret, issueKey, openKey, sealPost, toBase64Url, fromBase64Url, unsealPost } from '@/lib/folio-crypto'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const sha256 = (text: string) => new Uint8Array(createHash('sha256').update(text).digest())

async function sealed(master: Uint8Array, text = 'meet me at the bridge') {
  return sealPost({ masterSecret: master, slug: 'demo-message', tagSlugs: ['friends'], plaintext: encoder.encode(text) })
}

describe('crypto demo', () => {
  it('seals, issues a key for the tag, opens it and unseals the same text', async () => {
    const master = generateMasterSecret()
    const post = await sealed(master)
    const key = await issueKey({ masterSecret: master, email: 'a@b.co', tags: ['friends'] })
    const plain = await unsealPost(post, await openKey(key, 'a@b.co'))
    expect(decoder.decode(plain!)).toBe('meet me at the bridge')
  })

  it('rejects a ciphertext with one byte changed, and a key for another tag opens nothing', async () => {
    const master = generateMasterSecret()
    const post = await sealed(master)
    const bytes = fromBase64Url(post.body)
    bytes[3] ^= 1
    const grants = await openKey(await issueKey({ masterSecret: master, email: 'a@b.co', tags: ['friends'] }), 'a@b.co')
    await expect(unsealPost({ ...post, body: toBase64Url(bytes) }, grants)).rejects.toBeInstanceOf(FolioKeyError)
    const other = await openKey(await issueKey({ masterSecret: master, email: 'a@b.co', tags: ['family'] }), 'a@b.co')
    expect(await unsealPost(post, other)).toBeNull()
  })

  it('counts changed bits and measures entropy', () => {
    expect(bitDifference(sha256('abc'), sha256('abd'))).toBe(122)
    expect(bitDifference(sha256(''), sha256('a'))).toBe(129)
    expect(bitDifference(sha256('abc'), sha256('abc'))).toBe(0)
    expect(shannonEntropy('aaaa')).toBe(0)
    expect(shannonEntropy('ab')).toBe(1)
  })

  it('breaks a Caesar cipher on the English sample', () => {
    const sample = readFileSync(new URL('./fixtures/english-sample.txt', import.meta.url), 'utf8').trim()
    for (const shift of [1, 7, 19]) expect(breakCaesar(caesarEncrypt(sample, shift)).shift).toBe(shift)
  })
})
