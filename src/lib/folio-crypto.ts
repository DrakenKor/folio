/**
 * folio1 — envelope encryption for sealed blog posts.
 *
 * One master secret derives every other key. Each post gets a random content
 * encryption key; that CEK is wrapped once per unlock path (the post's own key,
 * plus one key per tag), so any granted reader recovers the same body.
 *
 * Reader keys are self-contained: they carry the grant material encrypted to the
 * recipient's email, and a metadata block that only the master secret can open.
 *
 * WebCrypto only — identical behaviour in Node 20+ and the browser.
 */

const VERSION = 1
const KEY_PREFIX = 'folio1_'

const KID_BYTES = 32
const NONCE_BYTES = 12
const CEK_BYTES = 32
const LID_BYTES = 8
const CHECK_BYTES = 4
const GCM_TAG_BYTES = 16

/** Locks are padded to this count with decoys so tag arity stays private. */
const MIN_LOCKS = 8

const INFO_AUDIT = 'folio/v1/audit'
const INFO_SEAL = 'folio/v1/seal'
const INFO_RECIPIENT = 'folio/v1/recipient'
const INFO_TAG = 'folio/v1/tag/'
const INFO_POST = 'folio/v1/post/'
const AAD_BODY = 'folio/v1/body|'
const AAD_LID = 'folio/v1/lid|'

const GRANT_MASTER = 0
const GRANT_TAG = 1
const GRANT_POST = 2

export type GrantType = 'master' | 'tag' | 'post'

export interface KeyGrantDescriptor {
  type: GrantType
  name?: string
}

/** Recovered from a reader key with the master secret. */
export interface KeyMetadata {
  email: string
  grants: KeyGrantDescriptor[]
  issuedAt: string
  label?: string
  expiresAt?: string
}

/** Recovered from a reader key with the recipient's email. */
export interface UnlockGrants {
  master?: Uint8Array
  tags: Map<string, Uint8Array>
  posts: Map<string, Uint8Array>
}

export interface SealedLock {
  lid: string
  nonce: string
  ct: string
}

export interface SealedPost {
  v: number
  slug: string
  nonce: string
  body: string
  locks: SealedLock[]
}

export class FolioKeyError extends Error {}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/* ------------------------------------------------------------------ bytes */

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }

  return out
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const out = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index)
  }

  return out
}

/** Reads a byte buffer front to back, refusing to run off the end. */
class Cursor {
  private offset = 0

  constructor(private readonly bytes: Uint8Array) {}

  take(length: number): Uint8Array {
    if (length < 0 || this.offset + length > this.bytes.length) {
      throw new FolioKeyError('Key is malformed: unexpected end of data.')
    }

    const slice = this.bytes.slice(this.offset, this.offset + length)
    this.offset += length

    return slice
  }

  takeByte(): number {
    return this.take(1)[0]
  }

  takeUint16(): number {
    const bytes = this.take(2)
    return (bytes[0] << 8) | bytes[1]
  }

  rest(): Uint8Array {
    return this.take(this.bytes.length - this.offset)
  }

  get done(): boolean {
    return this.offset >= this.bytes.length
  }
}

function uint16(value: number): Uint8Array {
  if (value < 0 || value > 0xffff) {
    throw new FolioKeyError('Value does not fit in two bytes.')
  }

  return new Uint8Array([(value >> 8) & 0xff, value & 0xff])
}

/* ------------------------------------------------------------ primitives */

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length = 32
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits'
  ])

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: textEncoder.encode(info) as BufferSource
    },
    key,
    length * 8
  )

  return new Uint8Array(bits)
}

async function aesSeal(
  rawKey: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', false, [
    'encrypt'
  ])

  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource },
    key,
    plaintext as BufferSource
  )

  return new Uint8Array(sealed)
}

async function aesOpen(
  rawKey: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array | null> {
  const key = await crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', false, [
    'decrypt'
  ])

  try {
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource },
      key,
      ciphertext as BufferSource
    )

    return new Uint8Array(opened)
  } catch {
    return null
  }
}

async function hmac(rawKey: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(message) as BufferSource
  )

  return new Uint8Array(signature)
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

/* ---------------------------------------------------------------- gzip */

async function pump(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    chunks.push(value)
  }

  return concat(...chunks)
}

export async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return pump(stream as ReadableStream<Uint8Array>)
}

export async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return pump(stream as ReadableStream<Uint8Array>)
}

/* ----------------------------------------------------------- derivation */

export function generateMasterSecret(): Uint8Array {
  return randomBytes(32)
}

/**
 * Emails are compared after normalisation so a reader typing "Me@Example.COM "
 * unlocks a key issued to "me@example.com". This binds a key to a person; it is
 * not a second factor, because email addresses are guessable. Secrecy lives in
 * the 256-bit kid.
 */
export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase()
}

async function deriveAuditKey(masterSecret: Uint8Array): Promise<Uint8Array> {
  return hkdf(masterSecret, new Uint8Array(0), INFO_AUDIT)
}

async function deriveSealKey(masterSecret: Uint8Array, kid: Uint8Array): Promise<Uint8Array> {
  return hkdf(await deriveAuditKey(masterSecret), kid, INFO_SEAL)
}

async function deriveRecipientKey(kid: Uint8Array, email: string): Promise<Uint8Array> {
  return hkdf(kid, textEncoder.encode(normalizeEmail(email)), INFO_RECIPIENT)
}

export async function deriveTagKey(
  masterSecret: Uint8Array,
  tagSlug: string
): Promise<Uint8Array> {
  return hkdf(masterSecret, new Uint8Array(0), INFO_TAG + tagSlug)
}

export async function derivePostKey(
  masterSecret: Uint8Array,
  slug: string
): Promise<Uint8Array> {
  return hkdf(masterSecret, new Uint8Array(0), INFO_POST + slug)
}

/**
 * Per-post lookup id. The slug is inside the HMAC, so one tag key yields a
 * different id on every post — an outsider cannot tell which posts share an
 * audience by comparing lock ids.
 */
async function lockId(unlockKey: Uint8Array, slug: string): Promise<Uint8Array> {
  return (await hmac(unlockKey, AAD_LID + slug)).slice(0, LID_BYTES)
}

/* -------------------------------------------------------- grant payload */

function encodeGrants(grants: UnlockGrants): Uint8Array {
  const parts: Uint8Array[] = []
  let count = 0

  const push = (type: number, name: string, key: Uint8Array) => {
    const nameBytes = textEncoder.encode(name)

    if (nameBytes.length > 0xff) {
      throw new FolioKeyError(`Grant name is too long: "${name}".`)
    }

    parts.push(new Uint8Array([type, nameBytes.length]), nameBytes, key)
    count += 1
  }

  if (grants.master) {
    push(GRANT_MASTER, '', grants.master)
  }

  for (const [tagSlug, key] of grants.tags) {
    push(GRANT_TAG, tagSlug, key)
  }

  for (const [slug, key] of grants.posts) {
    push(GRANT_POST, slug, key)
  }

  if (count === 0) {
    throw new FolioKeyError('A key must carry at least one grant.')
  }

  return concat(new Uint8Array([count]), ...parts)
}

function decodeGrants(bytes: Uint8Array): UnlockGrants {
  const cursor = new Cursor(bytes)
  const count = cursor.takeByte()
  const grants: UnlockGrants = { tags: new Map(), posts: new Map() }

  for (let index = 0; index < count; index += 1) {
    const type = cursor.takeByte()
    const name = textDecoder.decode(cursor.take(cursor.takeByte()))
    const key = cursor.take(32)

    if (type === GRANT_MASTER) {
      grants.master = key
    } else if (type === GRANT_TAG) {
      grants.tags.set(name, key)
    } else if (type === GRANT_POST) {
      grants.posts.set(name, key)
    } else {
      throw new FolioKeyError(`Unknown grant type ${type}.`)
    }
  }

  return grants
}

function describeGrants(grants: UnlockGrants): KeyGrantDescriptor[] {
  const described: KeyGrantDescriptor[] = []

  if (grants.master) {
    described.push({ type: 'master' })
  }

  for (const tagSlug of grants.tags.keys()) {
    described.push({ type: 'tag', name: tagSlug })
  }

  for (const slug of grants.posts.keys()) {
    described.push({ type: 'post', name: slug })
  }

  return described
}

/* ------------------------------------------------------------ reader key */

export interface IssueKeyParams {
  masterSecret: Uint8Array
  email: string
  /** Tag slugs, already normalised by slugifyTag. */
  tags?: string[]
  /** Post slugs. */
  posts?: string[]
  /** Embeds the master secret itself — this key opens everything, forever. */
  master?: boolean
  label?: string
  expiresAt?: string
  issuedAt?: string
}

export async function issueKey(params: IssueKeyParams): Promise<string> {
  const { masterSecret, email, tags = [], posts = [], master = false } = params

  const grants: UnlockGrants = { tags: new Map(), posts: new Map() }

  if (master) {
    grants.master = masterSecret
  }

  for (const tagSlug of tags) {
    grants.tags.set(tagSlug, await deriveTagKey(masterSecret, tagSlug))
  }

  for (const slug of posts) {
    grants.posts.set(slug, await derivePostKey(masterSecret, slug))
  }

  const kid = randomBytes(KID_BYTES)
  const grantsNonce = randomBytes(NONCE_BYTES)
  const metaNonce = randomBytes(NONCE_BYTES)

  const grantsCiphertext = await aesSeal(
    await deriveRecipientKey(kid, email),
    grantsNonce,
    kid,
    encodeGrants(grants)
  )

  const metadata: KeyMetadata = {
    email: normalizeEmail(email),
    grants: describeGrants(grants),
    issuedAt: params.issuedAt ?? new Date().toISOString(),
    ...(params.label ? { label: params.label } : {}),
    ...(params.expiresAt ? { expiresAt: params.expiresAt } : {})
  }

  // Binding the metadata to kid and to the grant ciphertext means one key's
  // identity cannot be grafted onto another key's grants.
  const metaCiphertext = await aesSeal(
    await deriveSealKey(masterSecret, kid),
    metaNonce,
    concat(kid, await sha256(grantsCiphertext)),
    textEncoder.encode(JSON.stringify(metadata))
  )

  const body = concat(
    new Uint8Array([VERSION]),
    kid,
    grantsNonce,
    uint16(grantsCiphertext.length),
    grantsCiphertext,
    metaNonce,
    metaCiphertext
  )

  return KEY_PREFIX + toBase64Url(concat(body, (await sha256(body)).slice(0, CHECK_BYTES)))
}

interface ParsedKey {
  kid: Uint8Array
  grantsNonce: Uint8Array
  grantsCiphertext: Uint8Array
  metaNonce: Uint8Array
  metaCiphertext: Uint8Array
}

async function parseKey(keyString: string): Promise<ParsedKey> {
  const trimmed = keyString.trim()

  if (!trimmed.startsWith(KEY_PREFIX)) {
    throw new FolioKeyError('Not a folio key — it should start with "folio1_".')
  }

  let raw: Uint8Array

  try {
    raw = fromBase64Url(trimmed.slice(KEY_PREFIX.length))
  } catch {
    throw new FolioKeyError('Key is malformed: it is not valid base64url.')
  }

  if (raw.length <= CHECK_BYTES) {
    throw new FolioKeyError('Key is malformed: too short.')
  }

  const body = raw.slice(0, raw.length - CHECK_BYTES)
  const check = raw.slice(raw.length - CHECK_BYTES)

  if (!equalBytes(check, (await sha256(body)).slice(0, CHECK_BYTES))) {
    throw new FolioKeyError('Key is malformed: checksum failed. It was probably copied wrong.')
  }

  const cursor = new Cursor(body)
  const version = cursor.takeByte()

  if (version !== VERSION) {
    throw new FolioKeyError(`Unsupported key version ${version}.`)
  }

  const kid = cursor.take(KID_BYTES)
  const grantsNonce = cursor.take(NONCE_BYTES)
  const grantsCiphertext = cursor.take(cursor.takeUint16())
  const metaNonce = cursor.take(NONCE_BYTES)
  const metaCiphertext = cursor.rest()

  if (metaCiphertext.length <= GCM_TAG_BYTES) {
    throw new FolioKeyError('Key is malformed: metadata block is truncated.')
  }

  return { kid, grantsNonce, grantsCiphertext, metaNonce, metaCiphertext }
}

/** Recipient side: key string plus the email it was issued to. */
export async function openKey(keyString: string, email: string): Promise<UnlockGrants> {
  const parsed = await parseKey(keyString)

  const opened = await aesOpen(
    await deriveRecipientKey(parsed.kid, email),
    parsed.grantsNonce,
    parsed.kid,
    parsed.grantsCiphertext
  )

  if (!opened) {
    throw new FolioKeyError('That key does not match that email address.')
  }

  return decodeGrants(opened)
}

/** Master side: recover who a key was issued to and what it opens. */
export async function inspectKey(
  masterSecret: Uint8Array,
  keyString: string
): Promise<KeyMetadata> {
  const parsed = await parseKey(keyString)

  const opened = await aesOpen(
    await deriveSealKey(masterSecret, parsed.kid),
    parsed.metaNonce,
    concat(parsed.kid, await sha256(parsed.grantsCiphertext)),
    parsed.metaCiphertext
  )

  if (!opened) {
    throw new FolioKeyError('This key was not issued by this master secret.')
  }

  return JSON.parse(textDecoder.decode(opened)) as KeyMetadata
}

/* ----------------------------------------------------------------- posts */

function shuffle<T>(items: T[]): T[] {
  const out = [...items]

  for (let index = out.length - 1; index > 0; index -= 1) {
    const bytes = randomBytes(4)
    const draw = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
    const pick = draw % (index + 1)
    ;[out[index], out[pick]] = [out[pick], out[index]]
  }

  return out
}

export interface SealPostParams {
  masterSecret: Uint8Array
  slug: string
  /** Tag slugs, already normalised by slugifyTag. */
  tagSlugs: string[]
  plaintext: Uint8Array
}

export async function sealPost(params: SealPostParams): Promise<SealedPost> {
  const { masterSecret, slug, tagSlugs, plaintext } = params

  const cek = randomBytes(CEK_BYTES)
  const bodyNonce = randomBytes(NONCE_BYTES)

  const body = await aesSeal(
    cek,
    bodyNonce,
    textEncoder.encode(AAD_BODY + slug),
    await compress(plaintext)
  )

  const unlockKeys = [
    await derivePostKey(masterSecret, slug),
    ...(await Promise.all(tagSlugs.map((tagSlug) => deriveTagKey(masterSecret, tagSlug))))
  ]

  const locks: SealedLock[] = []

  for (const unlockKey of unlockKeys) {
    const lid = await lockId(unlockKey, slug)
    const nonce = randomBytes(NONCE_BYTES)

    locks.push({
      lid: toBase64Url(lid),
      nonce: toBase64Url(nonce),
      ct: toBase64Url(await aesSeal(unlockKey, nonce, lid, cek))
    })
  }

  // Decoys hide how many tags a post carries. They never match a real lock id,
  // so no honest reader ever attempts them.
  while (locks.length < MIN_LOCKS) {
    locks.push({
      lid: toBase64Url(randomBytes(LID_BYTES)),
      nonce: toBase64Url(randomBytes(NONCE_BYTES)),
      ct: toBase64Url(randomBytes(CEK_BYTES + GCM_TAG_BYTES))
    })
  }

  return {
    v: VERSION,
    slug,
    nonce: toBase64Url(bodyNonce),
    body: toBase64Url(body),
    locks: shuffle(locks)
  }
}

/**
 * Returns null when the grants do not open this post — that is an ordinary
 * outcome, not an error. Throws only when the artifact itself is unusable.
 */
export async function unsealPost(
  sealed: SealedPost,
  grants: UnlockGrants
): Promise<Uint8Array | null> {
  if (sealed.v !== VERSION) {
    throw new FolioKeyError(`Unsupported sealed post version ${sealed.v}.`)
  }

  const candidates: Uint8Array[] = []

  if (grants.master) {
    candidates.push(await derivePostKey(grants.master, sealed.slug))
  }

  const postGrant = grants.posts.get(sealed.slug)

  if (postGrant) {
    candidates.push(postGrant)
  }

  for (const tagKey of grants.tags.values()) {
    candidates.push(tagKey)
  }

  for (const candidate of candidates) {
    const lid = await lockId(candidate, sealed.slug)
    const encodedLid = toBase64Url(lid)
    const lock = sealed.locks.find((entry) => entry.lid === encodedLid)

    if (!lock) {
      continue
    }

    const cek = await aesOpen(candidate, fromBase64Url(lock.nonce), lid, fromBase64Url(lock.ct))

    if (!cek) {
      throw new FolioKeyError('Sealed post is corrupt: a lock failed to open.')
    }

    const body = await aesOpen(
      cek,
      fromBase64Url(sealed.nonce),
      textEncoder.encode(AAD_BODY + sealed.slug),
      fromBase64Url(sealed.body)
    )

    if (!body) {
      throw new FolioKeyError('Sealed post is corrupt: the body failed to open.')
    }

    return decompress(body)
  }

  return null
}
