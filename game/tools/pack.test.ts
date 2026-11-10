import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const fixtures: string[] = []

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'folio-assets-test-'))
  fixtures.push(root)
  mkdirSync(join(root, 'game/tools'), { recursive: true })
  for (const name of ['pack.mjs', 'fetch.mjs']) {
    const source = fileURLToPath(new URL(name, import.meta.url))
    if (existsSync(source)) copyFileSync(source, join(root, 'game/tools', name))
  }
  mkdirSync(join(root, 'game/assets-local/built/pack/characters'), { recursive: true })
  writeFileSync(join(root, 'game/assets-local/built/pack/characters/knight.glb'), 'fixture knight')
  return root
}

function cli(root: string, tool: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'game/tools', `${tool}.mjs`)], { cwd: root })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', status => resolve({ status, stdout, stderr }))
  })
}

function lock(root: string) {
  return JSON.parse(readFileSync(join(root, 'game/assets.lock.json'), 'utf8')) as {
    name: string; sha256: string; bytes: number; url: string
  }
}

function localUrl(root: string) {
  const value = lock(root)
  value.url = pathToFileURL(join(root, 'game/.packs', value.name)).href
  writeFileSync(join(root, 'game/assets.lock.json'), JSON.stringify(value))
  return value
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('asset pack and fetch CLIs', () => {
  it('packs the same files identically despite creation order, mtimes and permissions', async () => {
    const root = fixture()
    const built = join(root, 'game/assets-local/built')
    writeFileSync(join(built, 'z.txt'), 'last')
    writeFileSync(join(built, 'a file.txt'), 'first')
    mkdirSync(join(built, 'empty'))
    const first = await cli(root, 'pack')
    expect(first.status, first.stderr).toBe(0)
    const expected = lock(root)
    const archive = readFileSync(join(root, 'game/.packs', expected.name))
    expect(expected).toEqual({
      name: `game-assets-${expected.sha256.slice(0, 12)}.tar`,
      sha256: createHash('sha256').update(archive).digest('hex'),
      bytes: archive.length,
      url: `https://github.com/DrakenKor/folio/releases/download/game-assets-${expected.sha256.slice(0, 12)}/${expected.name}`
    })
    rmSync(built, { recursive: true })
    mkdirSync(join(built, 'empty'), { recursive: true })
    writeFileSync(join(built, 'a file.txt'), 'first')
    writeFileSync(join(built, 'z.txt'), 'last')
    mkdirSync(join(built, 'pack/characters'), { recursive: true })
    writeFileSync(join(built, 'pack/characters/knight.glb'), 'fixture knight')
    chmodSync(join(built, 'z.txt'), 0o700)
    utimesSync(join(built, 'z.txt'), 123456, 123456)
    const second = await cli(root, 'pack')
    expect(second.status, second.stderr).toBe(0)
    expect(lock(root)).toEqual(expected)
    expect(readFileSync(join(root, 'game/.packs', expected.name))).toEqual(archive)
  })

  it('downloads over HTTP into a fresh tree, then skips downloading matching assets', async () => {
    const root = fixture()
    const packed = await cli(root, 'pack')
    expect(packed.status, packed.stderr).toBe(0)
    const value = lock(root)
    const archive = readFileSync(join(root, 'game/.packs', value.name))
    let requests = 0
    const server = createServer((_, response) => { requests++; response.end(archive) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address() as { port: number }
      value.url = `http://127.0.0.1:${address.port}/${value.name}`
      writeFileSync(join(root, 'game/assets.lock.json'), JSON.stringify(value))
      rmSync(join(root, 'game/assets-local'), { recursive: true })
      rmSync(join(root, 'game/.packs'), { recursive: true })
      const fetched = await cli(root, 'fetch')
      expect(fetched.status, fetched.stderr).toBe(0)
      const knight = join(root, 'game/assets-local/built/pack/characters/knight.glb')
      expect(readFileSync(knight, 'utf8')).toBe('fixture knight')
      const modified = statSync(knight).mtimeMs
      const repeated = await cli(root, 'fetch')
      expect(repeated.status, repeated.stderr).toBe(0)
      expect(requests).toBe(1)
      expect(statSync(knight).mtimeMs).toBe(modified)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  it('repairs modified, missing and extra files while preserving source downloads', async () => {
    const root = fixture()
    const packed = await cli(root, 'pack')
    expect(packed.status, packed.stderr).toBe(0)
    localUrl(root)
    const built = join(root, 'game/assets-local/built')
    mkdirSync(join(root, 'game/assets-local/src'))
    writeFileSync(join(root, 'game/assets-local/src/LICENSE.txt'), 'keep source')
    for (const change of ['modified', 'missing', 'extra']) {
      const knight = join(built, 'pack/characters/knight.glb')
      if (change === 'modified') writeFileSync(knight, 'edited')
      if (change === 'missing') rmSync(knight)
      if (change === 'extra') writeFileSync(join(built, 'extra.txt'), 'stale')
      const fetched = await cli(root, 'fetch')
      expect(fetched.status, fetched.stderr).toBe(0)
      expect(readFileSync(knight, 'utf8')).toBe('fixture knight')
      expect(existsSync(join(built, 'extra.txt'))).toBe(false)
      expect(readFileSync(join(root, 'game/assets-local/src/LICENSE.txt'), 'utf8')).toBe('keep source')
    }
  })

  it('rejects a same-size tampered pack on checksum and leaves built untouched', async () => {
    const root = fixture()
    const packed = await cli(root, 'pack')
    expect(packed.status, packed.stderr).toBe(0)
    const value = localUrl(root)
    const built = join(root, 'game/assets-local/built')
    writeFileSync(join(built, 'local.txt'), 'keep local bytes')
    const archivePath = join(root, 'game/.packs', value.name)
    const archive = readFileSync(archivePath)
    archive[1536] = archive[1536]! ^ 1
    writeFileSync(archivePath, archive)
    const fetched = await cli(root, 'fetch')
    expect(fetched.status).toBe(1)
    expect(fetched.stderr).toMatch(/checksum/i)
    expect(readFileSync(join(built, 'local.txt'), 'utf8')).toBe('keep local bytes')
    expect(readFileSync(join(built, 'pack/characters/knight.glb'), 'utf8')).toBe('fixture knight')
    expect(readdirSync(join(root, 'game/assets-local')).sort()).toEqual(['built'])
  })

  it('leaves built untouched when a checksum-valid archive cannot be extracted', async () => {
    const root = fixture()
    const invalid = Buffer.from('not a tar archive')
    const sha256 = createHash('sha256').update(invalid).digest('hex')
    const name = `game-assets-${sha256.slice(0, 12)}.tar`
    writeFileSync(join(root, name), invalid)
    writeFileSync(join(root, 'game/assets.lock.json'), JSON.stringify({ name, sha256, bytes: invalid.length, url: pathToFileURL(join(root, name)).href }))
    const fetched = await cli(root, 'fetch')
    expect(fetched.status).toBe(1)
    expect(fetched.stderr).toMatch(/archive|tar:|extract|truncated/i)
    expect(readFileSync(join(root, 'game/assets-local/built/pack/characters/knight.glb'), 'utf8')).toBe('fixture knight')
    expect(readdirSync(join(root, 'game/assets-local')).sort()).toEqual(['built'])
  })
})
