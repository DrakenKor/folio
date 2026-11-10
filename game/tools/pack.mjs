#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, createReadStream, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const gameDir = fileURLToPath(new URL('../', import.meta.url))

export async function checksum(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

// Stage ordinary files with fixed metadata so tar never includes host metadata.
export function archiveBuilt(built, target) {
  if (!lstatSync(built).isDirectory()) throw new Error(`Expected an asset directory: ${built}`)
  const staging = mkdtempSync(join(dirname(target), '.pack-'))
  const entries = []
  function copy(relative) {
    for (const name of readdirSync(join(built, relative)).sort()) {
      const entry = relative ? `${relative}/${name}` : name
      const source = join(built, entry)
      const destination = join(staging, entry)
      const stat = lstatSync(source)
      if (stat.isDirectory()) {
        mkdirSync(destination)
        entries.push(entry)
        copy(entry)
      } else if (stat.isFile()) {
        copyFileSync(source, destination)
        entries.push(entry)
      } else {
        throw new Error(`Assets must be ordinary files or directories: ${entry}`)
      }
      chmodSync(destination, stat.isDirectory() ? 0o755 : 0o644)
      utimesSync(destination, 0, 0)
    }
  }
  try {
    copy('')
    execFileSync('tar', [
      '-cf', target, '--format=ustar', '--blocking-factor=1',
      '--owner=0', '--group=0', '--numeric-owner', '--no-acls', '--no-xattrs',
      '--no-recursion', '-C', staging, '--null', '-T', '-'
    ], {
      input: entries.sort().map(entry => `./${entry}\0`).join(''),
      env: { ...process.env, COPYFILE_DISABLE: '1', TAR_OPTIONS: '', LC_ALL: 'C' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

async function main() {
  const packs = join(gameDir, '.packs')
  mkdirSync(packs, { recursive: true })
  const scratch = mkdtempSync(join(packs, '.pack-'))
  try {
    const archive = join(scratch, 'assets.tar')
    archiveBuilt(join(gameDir, 'assets-local/built'), archive)
    const sha256 = await checksum(archive)
    const tag = `game-assets-${sha256.slice(0, 12)}`
    const name = `${tag}.tar`
    const lock = {
      name,
      sha256,
      bytes: statSync(archive).size,
      url: `https://github.com/DrakenKor/folio/releases/download/${tag}/${name}`
    }
    renameSync(archive, join(packs, name))
    const lockFile = join(scratch, 'assets.lock.json')
    writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`)
    renameSync(lockFile, join(gameDir, 'assets.lock.json'))
    console.log(JSON.stringify(lock, null, 2))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`game:pack: ${error.message}`)
    process.exitCode = 1
  })
}
