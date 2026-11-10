#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { archiveBuilt, checksum, gameDir } from './pack.mjs'

async function main() {
  const lock = JSON.parse(readFileSync(join(gameDir, 'assets.lock.json'), 'utf8'))
  if (!/^[a-f0-9]{64}$/.test(lock.sha256) ||
      lock.name !== `game-assets-${lock.sha256.slice(0, 12)}.tar` ||
      !Number.isSafeInteger(lock.bytes) || lock.bytes <= 0) {
    throw new Error('Invalid game/assets.lock.json')
  }
  const url = new URL(lock.url)
  if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw new Error('Unsupported asset URL')

  const local = join(gameDir, 'assets-local')
  const built = join(local, 'built')
  mkdirSync(local, { recursive: true })
  const scratch = mkdtempSync(join(local, '.fetch-'))
  try {
    const archive = join(scratch, lock.name)
    if (existsSync(built)) {
      // Repacking detects changed, missing and extra files without trusting mtimes.
      try {
        archiveBuilt(built, archive)
        if (await checksum(archive) === lock.sha256) {
          console.log(`Assets already match ${lock.name}`)
          return
        }
      } catch {
        // A malformed local tree is replaced by the verified pack.
      }
    }

    if (url.protocol === 'file:') {
      copyFileSync(fileURLToPath(url), archive)
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok || !response.body) throw new Error(`Asset download failed: HTTP ${response.status}`)
      await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))
    }
    const sha256 = await checksum(archive)
    if (sha256 !== lock.sha256) throw new Error(`Asset checksum mismatch: expected ${lock.sha256}, got ${sha256}`)
    if (statSync(archive).size !== lock.bytes) throw new Error('Asset pack size differs from the lock')

    const extracted = join(scratch, 'built')
    mkdirSync(extracted)
    execFileSync('tar', ['-xf', archive, '-C', extracted, '--no-same-owner', '--no-same-permissions'], { stdio: 'pipe' })

    // Download and extraction finish before replacing the existing built tree.
    const previous = join(scratch, 'previous')
    const hadBuilt = existsSync(built)
    if (hadBuilt) renameSync(built, previous)
    try {
      renameSync(extracted, built)
    } catch (error) {
      if (hadBuilt) renameSync(previous, built)
      throw error
    }
    console.log(`Fetched ${lock.name}: ${lock.bytes} bytes, SHA-256 ${sha256}`)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(`game:fetch: ${error.message}`)
  process.exitCode = 1
})
