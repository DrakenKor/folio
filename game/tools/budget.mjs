#!/usr/bin/env node
// Size budgets for the game and the site it ships in (plan section 7).
// Prints a table and exits 1 if any cap is exceeded. Run from folio/.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { gzipSync } from 'node:zlib'

const MB = 1024 * 1024
const CAPS = {
  gameDeploy: 500 * MB,
  site: 900 * MB,
  gameJsGzip: 3 * MB,
  firstLoad: 30 * MB,
  gitGrowth: 50 * MB
}
const GZIP_TYPES = new Set(['.js', '.mjs', '.css', '.html', '.json', '.wasm', '.svg'])

function files(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...files(p))
    else if (e.isFile()) out.push(p)
  }
  return out
}

const sum = list => list.reduce((a, b) => a + b, 0)
const fmt = bytes => (bytes == null ? 'not measured' : `${(bytes / MB).toFixed(2)} MB`)

// The game build as game:build last wrote it; next build copies it to out/play.
const gameDir = 'public/play'
const gameFiles = files(gameDir)
const gameRaw = sum(gameFiles.map(f => statSync(f).size))
const gameGzip = sum(
  gameFiles.map(f => (GZIP_TYPES.has(extname(f)) ? gzipSync(readFileSync(f), { level: 9 }).length : statSync(f).size))
)
const jsGzip = sum(
  gameFiles.filter(f => ['.js', '.mjs'].includes(extname(f))).map(f => gzipSync(readFileSync(f), { level: 9 }).length)
)
const siteRaw = existsSync('out') ? sum(files('out').map(f => statSync(f).size)) : null

function readJson(file, retry) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file} is ${error.code === 'ENOENT' ? 'missing' : 'invalid'}; ${retry}`, { cause: error })
  }
}

const hasBuild = value => typeof value?.build === 'string' && value.build.length > 0 && !/\s/.test(value.build)
let firstLoad
try {
  const buildFile = join(gameDir, 'build.json')
  const rebuild = 'run game:build'
  const metadata = readJson(buildFile, rebuild)
  if (!hasBuild(metadata) || Object.keys(metadata).length !== 1) throw new Error(`${buildFile} has an invalid build id or shape; ${rebuild}`)
  const reportFile = 'game/.play-out/net.json'
  const remeasure = 'run game:play -- boot, then game:play -- net'
  const network = readJson(reportFile, remeasure)
  if (!hasBuild(network)) throw new Error(`${reportFile} has an invalid build id; ${remeasure}`)
  if (!Number.isSafeInteger(network.bytes) || network.bytes <= 0) throw new Error(`${reportFile} has invalid transfer bytes; ${remeasure}`)
  if (network.build !== metadata.build) throw new Error(`Network build mismatch: report ${network.build}, ${buildFile} ${metadata.build}; ${remeasure}`)
  firstLoad = network.bytes
} catch (error) {
  console.error(`game:budget: ${error.message}`)
  process.exit(1)
}

// Every blob ever committed under game/, on every branch.
let gitGrowth = null
try {
  const objects = execFileSync('git', ['rev-list', '--objects', '--all', '--', 'game'], { encoding: 'utf8', maxBuffer: 256 * MB })
  const ids = objects.split('\n').filter(Boolean).map(line => line.split(' ')[0]).join('\n')
  const sizes = execFileSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectsize:disk)'], { input: ids, encoding: 'utf8', maxBuffer: 256 * MB })
  gitGrowth = sum(sizes.split('\n').filter(l => l.startsWith('blob ')).map(l => Number(l.split(' ')[1])))
} catch {}

const rows = [
  ['Game files in the deploy', gameRaw, CAPS.gameDeploy, `${gameDir}, ${gameFiles.length} files, ${fmt(gameGzip)} gzipped`],
  ['Whole out/', siteRaw, CAPS.site, siteRaw == null ? 'run npm run build first' : ''],
  ['Game JavaScript, gzipped', jsGzip, CAPS.gameJsGzip, ''],
  ['First playable download', firstLoad, CAPS.firstLoad, firstLoad == null ? 'run game:play net first' : 'game/.play-out/net.json'],
  ['Git history under game/', gitGrowth, CAPS.gitGrowth, 'all branches, on-disk size']
]

let breached = false
console.log('Budget                      Size          Cap        Status')
for (const [name, size, cap, note] of rows) {
  const over = size != null && size > cap
  breached ||= over
  const status = size == null ? 'skip' : over ? 'OVER' : 'ok'
  console.log(`${name.padEnd(27)} ${fmt(size).padEnd(13)} ${fmt(cap).padEnd(10)} ${status.padEnd(5)} ${note}`)
}
process.exit(breached ? 1 : 0)
