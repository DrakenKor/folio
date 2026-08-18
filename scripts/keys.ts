/**
 * folio1 key management CLI.
 *
 * Subcommands:
 *   tsx scripts/keys.ts master                    generate ~/.folio/master.key
 *   tsx scripts/keys.ts issue --email a@b.com ...  issue a reader key
 *   tsx scripts/keys.ts inspect folio1_...         show what a key grants
 *
 * Wired up as npm run keys:master / keys:issue / keys:inspect.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import matter from 'gray-matter'
import {
  fromBase64Url,
  generateMasterSecret,
  inspectKey,
  issueKey,
  toBase64Url,
  type KeyGrantDescriptor
} from '../src/lib/folio-crypto'
import { slugifyTag } from '../src/lib/blog-helpers'

const MASTER_KEY_DIR = path.join(os.homedir(), '.folio')
const MASTER_KEY_PATH = path.join(MASTER_KEY_DIR, 'master.key')

interface ParsedCli {
  flags: Record<string, string | boolean>
  positionals: string[]
}

function parseCli(argv: string[]): ParsedCli {
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const name = token.slice(2)
    const next = argv[index + 1]

    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next
      index += 1
    } else {
      flags[name] = true
    }
  }

  return { flags, positionals }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** The master secret comes from $FOLIO_MASTER_KEY, or ~/.folio/master.key otherwise. */
function loadMasterSecret(): Uint8Array {
  const fromEnv = process.env.FOLIO_MASTER_KEY

  if (fromEnv) {
    return fromBase64Url(fromEnv.trim())
  }

  if (!fs.existsSync(MASTER_KEY_PATH)) {
    fail(
      `No master secret found at ${MASTER_KEY_PATH} (and $FOLIO_MASTER_KEY is not set).\n` +
        'Run "npm run keys:master" first.'
    )
  }

  return fromBase64Url(fs.readFileSync(MASTER_KEY_PATH, 'utf8').trim())
}

function describeGrant(grant: KeyGrantDescriptor): string {
  return grant.name ? `${grant.type}:${grant.name}` : grant.type
}

interface SealedInventory {
  slugs: Set<string>
  tagSlugs: Set<string>
}

/**
 * What is actually sealed right now, read from folio-sealed. Used only to catch
 * typos at issue time: keys derive from the literal slug string, so a misspelled
 * grant produces a key that opens nothing and fails silently in the reader's
 * hands. Returns null when folio-sealed is not present — the CLI still works.
 */
function readSealedInventory(): SealedInventory | null {
  const postsDir = path.join(process.cwd(), '..', 'folio-sealed', 'posts')

  if (!fs.existsSync(postsDir)) {
    return null
  }

  const inventory: SealedInventory = { slugs: new Set(), tagSlugs: new Set() }

  for (const fileName of fs.readdirSync(postsDir)) {
    if (!fileName.endsWith('.mdx')) {
      continue
    }

    const { data } = matter(fs.readFileSync(path.join(postsDir, fileName), 'utf8'))

    if (data.sealed !== true) {
      continue
    }

    inventory.slugs.add(path.basename(fileName, '.mdx'))

    for (const tag of Array.isArray(data.tags) ? data.tags : []) {
      inventory.tagSlugs.add(slugifyTag(String(tag)))
    }
  }

  return inventory
}

function checkGrantsAreUsable(tags: string[], posts: string[]) {
  const inventory = readSealedInventory()

  if (!inventory) {
    return
  }

  const unknownPosts = posts.filter((slug) => !inventory.slugs.has(slug))

  if (unknownPosts.length > 0) {
    fail(
      `No sealed post matches: ${unknownPosts.join(', ')}\n` +
        'A key for a slug that is not sealed can never open anything. ' +
        `Sealed posts: ${[...inventory.slugs].sort().join(', ') || '(none yet)'}`
    )
  }

  const unusedTags = tags.filter((tagSlug) => !inventory.tagSlugs.has(tagSlug))

  if (unusedTags.length > 0) {
    console.warn(
      `Warning: no sealed post currently carries ${unusedTags.join(', ')}. ` +
        'The key is valid and will work once one does.'
    )
  }
}

function runMaster() {
  if (fs.existsSync(MASTER_KEY_PATH)) {
    fail(`Refusing to overwrite existing master secret at ${MASTER_KEY_PATH}.`)
  }

  fs.mkdirSync(MASTER_KEY_DIR, { recursive: true, mode: 0o700 })
  fs.chmodSync(MASTER_KEY_DIR, 0o700)

  const secret = generateMasterSecret()
  fs.writeFileSync(MASTER_KEY_PATH, `${toBase64Url(secret)}\n`, { mode: 0o600 })
  fs.chmodSync(MASTER_KEY_PATH, 0o600)

  console.log(MASTER_KEY_PATH)
}

async function runIssue(argv: string[]) {
  const { flags } = parseCli(argv)
  const masterSecret = loadMasterSecret()

  const email = typeof flags.email === 'string' ? flags.email : undefined

  if (!email) {
    fail('--email is required.')
  }

  const tags =
    typeof flags.tags === 'string'
      ? flags.tags
          .split(',')
          .map((tag) => slugifyTag(tag.trim()))
          .filter(Boolean)
      : []

  const posts =
    typeof flags.posts === 'string'
      ? flags.posts
          .split(',')
          .map((slug) => slug.trim())
          .filter(Boolean)
      : []

  const master = flags.master === true

  if (tags.length === 0 && posts.length === 0 && !master) {
    fail('Provide at least one of --tags, --posts, --master.')
  }

  checkGrantsAreUsable(tags, posts)

  const label = typeof flags.label === 'string' ? flags.label : undefined
  const expiresAt = typeof flags.expires === 'string' ? flags.expires : undefined

  const key = await issueKey({ masterSecret, email, tags, posts, master, label, expiresAt })
  const metadata = await inspectKey(masterSecret, key)

  console.log(key)
  console.log('')
  console.log(`Issued to: ${metadata.email}`)
  console.log(`Grants:    ${metadata.grants.map(describeGrant).join(', ')}`)

  if (metadata.label) {
    console.log(`Label:     ${metadata.label}`)
  }

  if (metadata.expiresAt) {
    console.log(`Expires:   ${metadata.expiresAt}`)
  }
}

async function runInspect(argv: string[]) {
  const { positionals } = parseCli(argv)
  const keyString = positionals[0]

  if (!keyString) {
    fail('Usage: npm run keys:inspect -- <folio1_...>')
  }

  const masterSecret = loadMasterSecret()
  const metadata = await inspectKey(masterSecret, keyString)

  console.log(`Email:     ${metadata.email}`)
  console.log(`Issued at: ${metadata.issuedAt}`)

  if (metadata.label) {
    console.log(`Label:     ${metadata.label}`)
  }

  if (metadata.expiresAt) {
    console.log(`Expires:   ${metadata.expiresAt}`)
  }

  console.log('Grants:')

  for (const grant of metadata.grants) {
    console.log(`  - ${describeGrant(grant)}`)
  }
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2)

  if (subcommand === 'master') {
    runMaster()
    return
  }

  if (subcommand === 'issue') {
    await runIssue(rest)
    return
  }

  if (subcommand === 'inspect') {
    await runInspect(rest)
    return
  }

  fail('Usage: tsx scripts/keys.ts <master|issue|inspect> [...args]')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
