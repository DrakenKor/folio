// Converts character sources in game/assets-local/src/ into one compressed
// .glb per character in game/assets-local/built/pack/characters/. Keeps only the
// listed clips (renamed to game names) and accessories, then prunes, resamples
// and meshopt-compresses with gltf-transform. Re-running reproduces built/.
//
//   node game/tools/assets/build-characters.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const gameDir = join(dirname(fileURLToPath(import.meta.url)), '../..')
const srcDir = join(gameDir, 'assets-local/src')
const outDir = join(gameDir, 'assets-local/built/pack/characters')
const gltfTransform = join(gameDir, '../node_modules/.bin/gltf-transform')

/** Game clip name → source clip name. */
const KAYKIT_CLIPS = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  attack: '1H_Melee_Attack_Chop',
  attack_slice: '1H_Melee_Attack_Slice_Diagonal',
  attack_stab: '1H_Melee_Attack_Stab',
  cast: 'Spellcast_Shoot',
  cast_long: 'Spellcast_Long',
  dodge: 'Dodge_Forward',
  block: 'Blocking',
  hit: 'Hit_A',
  death: 'Death_A'
}

const CHARACTERS = [
  {
    id: 'knight',
    src: 'kaykit-adventurers-1.0/Knight.glb',
    clips: KAYKIT_CLIPS,
    /** Accessory nodes attached to hand slots; all but the chosen kit are dropped. */
    dropMeshes: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword']
  }
]

function readGlb(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a GLB`)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  return { json, bin: buf.subarray(20 + jsonLength) }
}

function writeGlb(path, json, bin) {
  let text = JSON.stringify(json)
  while (Buffer.byteLength(text) % 4 !== 0) text += ' '
  const jsonBytes = Buffer.from(text)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + jsonBytes.length + bin.length, 8)
  header.writeUInt32LE(jsonBytes.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  writeFileSync(path, Buffer.concat([header, jsonBytes, bin]))
}

/** Keeps and renames the listed clips and detaches dropped meshes; prune removes the orphaned data. */
function select(json, { clips, dropMeshes }) {
  const bySource = new Map(json.animations.map((a) => [a.name, a]))
  json.animations = Object.entries(clips).map(([name, source]) => {
    const anim = bySource.get(source)
    if (!anim) throw new Error(`missing clip ${source}`)
    return { ...anim, name }
  })
  for (const name of dropMeshes) {
    const node = json.nodes.find((n) => n.name === name)
    if (!node) throw new Error(`missing node ${name}`)
    delete node.mesh
  }
}

const run = (...args) => execFileSync(gltfTransform, args, { stdio: ['ignore', 'ignore', 'inherit'] })

mkdirSync(outDir, { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), 'folio-characters-'))
try {
  for (const character of CHARACTERS) {
    const { json, bin } = readGlb(join(srcDir, character.src))
    select(json, character)
    const selected = join(tmp, `${character.id}.selected.glb`)
    const pruned = join(tmp, `${character.id}.pruned.glb`)
    const resampled = join(tmp, `${character.id}.resampled.glb`)
    const out = join(outDir, `${character.id}.glb`)
    writeGlb(selected, json, bin)
    run('prune', selected, pruned)
    run('resample', pruned, resampled)
    run('meshopt', resampled, out, '--quantization-volume', 'scene')
    process.stdout.write(`${character.id}.glb  ${statSync(out).size} bytes  clips: ${Object.keys(character.clips).join(', ')}\n`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
