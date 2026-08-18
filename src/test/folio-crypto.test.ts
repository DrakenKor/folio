import { describe, expect, it } from 'vitest'
import {
  FolioKeyError,
  generateMasterSecret,
  inspectKey,
  issueKey,
  openKey,
  sealPost,
  unsealPost
} from '@/lib/folio-crypto'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const BODY = '# Quiet post\n\nSomething I only wanted a few people to read.'

async function sealFamilyPost(masterSecret: Uint8Array, slug = 'quiet-post') {
  return sealPost({
    masterSecret,
    slug,
    tagSlugs: ['family', 'japan'],
    plaintext: encoder.encode(BODY)
  })
}

describe('folio1 sealed posts', () => {
  it('round-trips a post through every tier of key', async () => {
    const masterSecret = generateMasterSecret()
    const sealed = await sealFamilyPost(masterSecret)

    const tagKey = await issueKey({
      masterSecret,
      email: 'Reader@Example.com ',
      tags: ['family'],
      label: 'family circle'
    })
    const postKey = await issueKey({
      masterSecret,
      email: 'one-off@example.com',
      posts: ['quiet-post']
    })
    const masterKey = await issueKey({
      masterSecret,
      email: 'me@example.com',
      master: true
    })

    // Email normalisation means the reader need not match the issuer's casing.
    for (const [key, email] of [
      [tagKey, 'reader@example.com'],
      [postKey, 'one-off@example.com'],
      [masterKey, 'me@example.com']
    ] as const) {
      const opened = await unsealPost(sealed, await openKey(key, email))
      expect(opened).not.toBeNull()
      expect(decoder.decode(opened!)).toBe(BODY)
    }

    // Only the master secret can say who a key belongs to.
    const metadata = await inspectKey(masterSecret, tagKey)
    expect(metadata.email).toBe('reader@example.com')
    expect(metadata.label).toBe('family circle')
    expect(metadata.grants).toEqual([{ type: 'tag', name: 'family' }])

    await expect(inspectKey(generateMasterSecret(), tagKey)).rejects.toThrow(FolioKeyError)
  })

  it('refuses a key presented with the wrong email', async () => {
    const masterSecret = generateMasterSecret()
    const key = await issueKey({ masterSecret, email: 'reader@example.com', tags: ['family'] })

    await expect(openKey(key, 'someone-else@example.com')).rejects.toThrow(
      /does not match that email/
    )
  })

  it('does not open a post the grant does not cover', async () => {
    const masterSecret = generateMasterSecret()
    const grants = await openKey(
      await issueKey({ masterSecret, email: 'reader@example.com', tags: ['family'] }),
      'reader@example.com'
    )

    // Right key, wrong post: no tag in common, and the post key is underivable.
    const otherPost = await sealPost({
      masterSecret,
      slug: 'work-notes',
      tagSlugs: ['work'],
      plaintext: encoder.encode('not for you')
    })

    expect(await unsealPost(otherPost, grants)).toBeNull()

    // A post-scoped grant does not spread to siblings sharing its tags.
    const postGrants = await openKey(
      await issueKey({ masterSecret, email: 'reader@example.com', posts: ['quiet-post'] }),
      'reader@example.com'
    )
    const sibling = await sealFamilyPost(masterSecret, 'another-family-post')

    expect(await unsealPost(sibling, postGrants)).toBeNull()
  })

  it('rejects tampered ciphertext and mangled keys', async () => {
    const masterSecret = generateMasterSecret()
    const sealed = await sealFamilyPost(masterSecret)
    const grants = await openKey(
      await issueKey({ masterSecret, email: 'reader@example.com', tags: ['family'] }),
      'reader@example.com'
    )

    const tampered = { ...sealed, body: `A${sealed.body.slice(1)}` }
    await expect(unsealPost(tampered, grants)).rejects.toThrow(/corrupt/)

    // Moving a body between posts fails: the slug is bound into the AAD.
    const relabelled = { ...sealed, slug: 'work-notes' }
    expect(await unsealPost(relabelled, grants)).toBeNull()

    const key = await issueKey({ masterSecret, email: 'reader@example.com', tags: ['family'] })
    await expect(openKey(`${key.slice(0, -2)}xy`, 'reader@example.com')).rejects.toThrow(
      /checksum/
    )
    await expect(openKey('not-a-folio-key', 'reader@example.com')).rejects.toThrow(/folio1_/)
  })
})
