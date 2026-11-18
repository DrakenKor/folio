import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const scratch = fileURLToPath(new URL('../.play-out/', import.meta.url))
const tool = fileURLToPath(new URL('./budget.mjs', import.meta.url))
const fixtures: string[] = []
const metadata = (root: string, text: string) => writeFileSync(join(root, 'public/play/build.json'), text)

function fixture() {
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(join(scratch, 'budget-test-'))
  fixtures.push(root)
  mkdirSync(join(root, 'public/play/assets'), { recursive: true })
  mkdirSync(join(root, 'game/.play-out'), { recursive: true })
  writeFileSync(join(root, 'public/play/index.html'), '<script type="module" src="/play/assets/entry.js"></script>')
  writeFileSync(join(root, 'public/play/assets/entry.js'), 'window.__game={build:"some-other-value"};')
  metadata(root, '{"build":"built-revision"}')
  return root
}

function net(root: string, build: unknown = 'built-revision', bytes: unknown = 1234) {
  writeFileSync(join(root, 'game/.play-out/net.json'), JSON.stringify({ build, bytes }))
}

function budget(root: string) {
  return spawnSync(process.execPath, [tool], { cwd: root, encoding: 'utf8' })
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('budget CLI first-load contract', () => {
  it('accepts a measured load stamped with the deployed metadata', () => {
    const root = fixture()
    net(root)
    const result = budget(root)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('First playable download')
  })

  it('fails clearly when the network report is missing', () => {
    const result = budget(fixture())
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/net\.json.*missing/i)
  })

  it('rejects a report from another build', () => {
    const root = fixture()
    net(root, 'older-revision')
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/build.*mismatch.*older-revision.*built-revision/i)
  })

  it.each([undefined, '', 42])('rejects an unstamped report (%s)', build => {
    const root = fixture()
    net(root, build === undefined ? null : build)
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/build/i)
  })

  it.each([null, -1, '1234'])('rejects invalid transfer bytes (%s)', bytes => {
    const root = fixture()
    net(root, 'built-revision', bytes)
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/bytes/i)
  })

  it('rejects a measured transfer over the cap', () => {
    const root = fixture()
    net(root, 'built-revision', 31 * 1024 * 1024)
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/First playable download.*OVER/)
  })

  it('rejects missing build metadata even when JavaScript has a matching stamp', () => {
    const root = fixture()
    net(root)
    rmSync(join(root, 'public/play/build.json'))
    writeFileSync(join(root, 'public/play/assets/entry.js'), 'window.__game={build:"built-revision"};')
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/public\/play\/build\.json.*missing/i)
  })

  it.each(['{', 'null', '[]', '{}', '{"build":42}', '{"build":"  "}', '{"build":"built-revision","extra":true}'])('rejects malformed metadata %s', text => {
    const root = fixture()
    net(root)
    metadata(root, text)
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/public\/play\/build\.json.*invalid/i)
  })

  it('rejects malformed report JSON', () => {
    const root = fixture()
    writeFileSync(join(root, 'game/.play-out/net.json'), '{')
    const result = budget(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/net\.json.*invalid/i)
  })
})
