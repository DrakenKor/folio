/**
 * Publishes folio-sealed/posts into this repo.
 *
 * Public posts (no `sealed: true`) are copied verbatim into
 * src/content/blog/. Sealed posts are compiled, encrypted with folio-crypto,
 * and split into a public teaser stub plus an encrypted artifact — the body
 * never enters this repository.
 *
 * npm run blog:publish            write files only
 * npm run blog:publish -- --commit  also commit in both repos (never pushes)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import matter from 'gray-matter'
import { fromBase64Url, sealPost, type SealedPost } from '../src/lib/folio-crypto'
import { slugifyTag } from '../src/lib/blog-helpers'
import { blogMdxOptions } from '../src/lib/blog-mdx-options'
import type { BlogStubFile, SealedIndex } from '../src/types/blog'

const FOLIO_ROOT = process.cwd()
const WORKSPACE_ROOT = path.resolve(FOLIO_ROOT, '..')
const SEALED_ROOT = path.join(WORKSPACE_ROOT, 'folio-sealed')
const SEALED_POSTS_DIR = path.join(SEALED_ROOT, 'posts')
const LOCK_FILE = path.join(SEALED_ROOT, 'blog-enc.lock.json')

const BLOG_CONTENT_DIR = path.join(FOLIO_ROOT, 'src', 'content', 'blog')
const STUBS_DIR = path.join(FOLIO_ROOT, 'src', 'content', 'stubs')
const BLOG_ENC_DIR = path.join(FOLIO_ROOT, 'public', 'blog-enc')

const MASTER_KEY_PATH = path.join(os.homedir(), '.folio', 'master.key')

const textEncoder = new TextEncoder()

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

function requireString(value: unknown, slug: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Sealed post "${slug}" is missing required frontmatter field "${field}".`)
  }

  return value.trim()
}

function requireTags(value: unknown, slug: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Sealed post "${slug}" needs at least one tag.`)
  }

  return value.map((tag) => String(tag).trim()).filter(Boolean)
}

function readLockFile(): Record<string, string> {
  if (!fs.existsSync(LOCK_FILE)) {
    return {}
  }

  return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as Record<string, string>
}

function writeLockFile(locks: Record<string, string>) {
  const sorted: Record<string, string> = {}

  for (const slug of Object.keys(locks).sort()) {
    sorted[slug] = locks[slug]
  }

  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
}

interface SealArgs {
  slug: string
  raw: Buffer
  data: Record<string, unknown>
  masterSecret: Uint8Array
  artifactPath: string
}

/** Compiles, encrypts and writes the artifact + teaser stub for one sealed post. */
async function sealOnePost({ slug, raw, data, masterSecret, artifactPath }: SealArgs) {
  const { content } = matter(raw.toString('utf8'))

  const title = requireString(data.title, slug, 'title')
  const description = requireString(data.description, slug, 'description')
  const date = requireString(data.date, slug, 'date')
  const tags = requireTags(data.tags, slug)

  // Dynamic import: this repo has no "type": "module", so tsx runs this file as
  // CommonJS. next-mdx-remote's compile chain is ESM-only several levels down
  // (e.g. estree-walker exposes no "require" condition), and a static import
  // gets rewritten to require(), which fails on those packages. A real
  // dynamic import() always goes through Node's native ESM loader instead.
  const { serialize } = await import('next-mdx-remote/serialize')

  // Matches src/app/blog/[slug]/page.tsx: serialize only the trimmed body,
  // frontmatter is stripped by gray-matter, not by next-mdx-remote.
  const serialized = await serialize(content.trim(), blogMdxOptions)
  const plaintext = textEncoder.encode(JSON.stringify(serialized))
  const tagSlugs = [...new Set(tags.map((tag) => slugifyTag(tag)))].filter(Boolean)

  const sealed = await sealPost({ masterSecret, slug, tagSlugs, plaintext })
  fs.writeFileSync(artifactPath, `${JSON.stringify(sealed, null, 2)}\n`)

  const stub: BlogStubFile = { slug, title, description, date, tags }
  fs.writeFileSync(path.join(STUBS_DIR, `${slug}.json`), `${JSON.stringify(stub, null, 2)}\n`)
}

function writeIndex(sealedSlugs: Set<string>) {
  const posts = [...sealedSlugs].sort().map((slug) => {
    const artifact = JSON.parse(
      fs.readFileSync(path.join(BLOG_ENC_DIR, `${slug}.json`), 'utf8')
    ) as SealedPost

    return { slug, lids: artifact.locks.map((lock) => lock.lid) }
  })

  const index: SealedIndex = { v: 1, posts }
  fs.writeFileSync(path.join(BLOG_ENC_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
}

function pruneDirectory(
  dir: string,
  extension: string,
  shouldRemove: (slug: string) => boolean
): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const removed: string[] = []

  for (const fileName of fs.readdirSync(dir)) {
    if (!fileName.endsWith(extension)) {
      continue
    }

    const slug = fileName.slice(0, -extension.length)

    if (shouldRemove(slug)) {
      fs.rmSync(path.join(dir, fileName))
      removed.push(path.join(dir, fileName))
    }
  }

  return removed
}

function pruneOrphans(publicSlugs: Set<string>, sealedSlugs: Set<string>): string[] {
  // A source directory that reads as empty — folio-sealed cloned but not yet
  // pulled, say — would otherwise prune every published post in one run.
  // Deleting everything is never the right answer to finding nothing.
  if (publicSlugs.size === 0 && sealedSlugs.size === 0) {
    fail(
      `No posts found in ${SEALED_POSTS_DIR}.\n` +
        'Refusing to prune, since that would delete every published post. ' +
        'Check that folio-sealed is cloned and up to date.'
    )
  }

  return [
    ...pruneDirectory(BLOG_CONTENT_DIR, '.mdx', (slug) => !publicSlugs.has(slug)),
    ...pruneDirectory(STUBS_DIR, '.json', (slug) => !sealedSlugs.has(slug)),
    ...pruneDirectory(BLOG_ENC_DIR, '.json', (slug) => slug !== 'index' && !sealedSlugs.has(slug))
  ]
}

function hasStagedChanges(cwd: string, paths: string[]): boolean {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet', '--', ...paths], { cwd })
    return false
  } catch {
    return true
  }
}

function commitRepo(cwd: string, paths: string[], message: string) {
  execFileSync('git', ['add', ...paths], { cwd })

  if (!hasStagedChanges(cwd, paths)) {
    console.log(`Nothing to commit in ${cwd}.`)
    return
  }

  execFileSync('git', ['commit', '-m', message], { cwd })
  console.log(`Committed in ${cwd}: ${message}`)
}

function commitChanges(counts: {
  copiedCount: number
  sealedCount: number
  skippedCount: number
  prunedCount: number
}) {
  commitRepo(
    FOLIO_ROOT,
    ['src/content/blog', 'src/content/stubs', 'public/blog-enc'],
    `Publish blog: ${counts.copiedCount} copied, ${counts.sealedCount} sealed, ` +
      `${counts.skippedCount} skipped, ${counts.prunedCount} pruned`
  )

  commitRepo(SEALED_ROOT, ['blog-enc.lock.json'], 'Update blog-enc.lock.json')
}

async function main() {
  const commit = process.argv.includes('--commit')
  const masterSecret = loadMasterSecret()

  fs.mkdirSync(BLOG_CONTENT_DIR, { recursive: true })
  fs.mkdirSync(STUBS_DIR, { recursive: true })
  fs.mkdirSync(BLOG_ENC_DIR, { recursive: true })

  const fileNames = fs
    .readdirSync(SEALED_POSTS_DIR)
    .filter((name) => name.endsWith('.mdx'))
    .sort()

  const publicSlugs = new Set<string>()
  const sealedSlugs = new Set<string>()

  const previousLocks = readLockFile()
  const nextLocks: Record<string, string> = {}

  let copiedCount = 0
  let sealedCount = 0
  let skippedCount = 0
  const skippedSlugs: string[] = []

  for (const fileName of fileNames) {
    const slug = path.basename(fileName, '.mdx')
    const fullPath = path.join(SEALED_POSTS_DIR, fileName)
    const raw = fs.readFileSync(fullPath)
    const { data } = matter(raw.toString('utf8'))

    if (data.sealed === true) {
      sealedSlugs.add(slug)

      const hash = createHash('sha256').update(raw).digest('hex')
      const artifactPath = path.join(BLOG_ENC_DIR, `${slug}.json`)

      if (previousLocks[slug] === hash && fs.existsSync(artifactPath)) {
        nextLocks[slug] = hash
        skippedCount += 1
        skippedSlugs.push(slug)
        continue
      }

      await sealOnePost({ slug, raw, data, masterSecret, artifactPath })
      nextLocks[slug] = hash
      sealedCount += 1
    } else {
      publicSlugs.add(slug)
      fs.writeFileSync(path.join(BLOG_CONTENT_DIR, `${slug}.mdx`), raw)
      copiedCount += 1
    }
  }

  const removed = pruneOrphans(publicSlugs, sealedSlugs)
  writeIndex(sealedSlugs)
  writeLockFile(nextLocks)

  console.log(`Copied:  ${copiedCount} public post(s)`)
  console.log(`Sealed:  ${sealedCount} post(s)`)
  console.log(
    `Skipped: ${skippedCount} unchanged sealed post(s)` +
      (skippedSlugs.length ? ` (${skippedSlugs.join(', ')})` : '')
  )
  console.log(`Pruned:  ${removed.length} orphaned file(s)`)

  if (commit) {
    commitChanges({ copiedCount, sealedCount, skippedCount, prunedCount: removed.length })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
