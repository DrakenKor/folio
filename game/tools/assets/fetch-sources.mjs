// Downloads the CC0 character sources into game/assets-local/src/, pinned to a
// commit and checked against SHA-256. Licences and provenance: game/ASSETS.md.
//
//   node game/tools/assets/fetch-sources.mjs
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const gameDir = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcDir = join(gameDir, 'assets-local/src')

const KAYKIT_ADVENTURERS =
  'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/' +
  '672074b73ba276876a19e8816ecdc5241817ab47/addons/kaykit_character_pack_adventures/'

const SOURCES = [
  {
    pack: 'kaykit-adventurers-1.0',
    base: KAYKIT_ADVENTURERS,
    files: {
      'LICENSE.txt': 'ae322141814056dda0deea7540d74c41d87aee1da319977cd1bd84ee5a923629',
      'Characters/gltf/Knight.glb': '60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168'
    }
  }
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

for (const { pack, base, files } of SOURCES) {
  const dir = join(srcDir, pack)
  mkdirSync(dir, { recursive: true })
  for (const [path, hash] of Object.entries(files)) {
    const out = join(dir, path.split('/').at(-1))
    if (existsSync(out) && sha256(readFileSync(out)) === hash) {
      process.stdout.write(`ok      ${pack}/${path}\n`)
      continue
    }
    const res = await fetch(base + path)
    if (!res.ok) throw new Error(`${res.status} fetching ${base + path}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const got = sha256(bytes)
    if (got !== hash) throw new Error(`SHA-256 mismatch for ${path}: expected ${hash}, got ${got}`)
    writeFileSync(out, bytes)
    process.stdout.write(`fetched ${pack}/${path} (${bytes.length} bytes)\n`)
  }
}
