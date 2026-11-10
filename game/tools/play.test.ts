import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const scratch = fileURLToPath(new URL('../.play-out/', import.meta.url))
const fixtures: string[] = []

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('play CLI disconnected CDP transport', () => {
  it.each(['pending', 'between calls'])('rejects promptly when the socket closes %s', mode => {
    mkdirSync(scratch, { recursive: true })
    const root = mkdtempSync(join(scratch, 'play-test-'))
    fixtures.push(root)
    mkdirSync(join(root, 'game/tools'), { recursive: true })
    mkdirSync(join(root, 'game/.play-out'), { recursive: true })
    const tool = join(root, 'game/tools/play.mjs')
    copyFileSync(fileURLToPath(new URL('./play.mjs', import.meta.url)), tool)
    writeFileSync(join(root, 'game/.play-out/session.json'), JSON.stringify({ browserUrl: 'ws://browser', targetId: 'game' }))
    // A CDP peer closes during the first command or immediately after its reply.
    const preload = `
      globalThis.fetch = async url => ({json:async()=>url.endsWith('/json/version')
        ? {webSocketDebuggerUrl:'ws://browser'}
        : [{id:'game',webSocketDebuggerUrl:'ws://page'}]});
      globalThis.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor() { setTimeout(()=>this.onopen?.(),0) }
        send(data) {
          if (this.readyState !== 1) return;
          const {id} = JSON.parse(data);
          queueMicrotask(()=>{
            ${mode === 'between calls' ? "this.onmessage?.({data:JSON.stringify({id,result:{}})});" : ''}
            this.readyState = 3;
            this.onclose?.({code:1006,reason:'test disconnect'});
          });
        }
        close() { this.readyState = 3 }
      };
    `
    const result = spawnSync(process.execPath, ['--import', `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`, tool, 'net'], {
      cwd: root, encoding: 'utf8', timeout: 2000, env: { ...process.env, PLAY_CDP_PORT: '9570' }
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/CDP connection closed.*test disconnect/)
  })
})

// Run with PLAY_ACCEPTANCE=1 and public/ served on loopback port 8790.
it.runIf(process.env.PLAY_ACCEPTANCE === '1')('captures both backends and measures a fresh headless load', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const tool = join(root, 'game/tools/play.mjs')
  const sessionFile = join(scratch, 'session.json')
  expect(existsSync(sessionFile), 'Stop the existing harness browser first').toBe(false)
  // Test the larger viewport without changing the harness's ordinary viewport.
  const metrics = `
    const NativeWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class extends NativeWebSocket {
      send(data) {
        const message = JSON.parse(data);
        if (message.method === 'Emulation.setDeviceMetricsOverride') message.params.deviceScaleFactor = 2;
        super.send(JSON.stringify(message));
      }
    };
  `
  const cli = (args: string[], large = false, input?: string) => {
    const imports = large ? ['--import', `data:text/javascript;base64,${Buffer.from(metrics).toString('base64')}`] : []
    const result = spawnSync(process.execPath, [...imports, tool, ...args], {
      cwd: root, encoding: 'utf8', input, timeout: 30000,
      env: { ...process.env, PLAY_CDP_PORT: '9570', PLAY_HEADLESS: '1' }
    })
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    return result.stdout
  }
  try {
    for (const backend of ['webgpu', 'webgl']) {
      cli(['boot', `http://127.0.0.1:8790/play/?backend=${backend}`])
      cli(['run', '/dev/stdin'], false, JSON.stringify({ steps: [
        { op: 'eval', expression: '__game.backend', expect: backend === 'webgl' ? 'webgl2' : 'webgpu' }
      ] }))
      const name = `t011-${backend}-2880.png`
      cli(['shot', 'meadow-wide', name], true)
      const png = readFileSync(join(scratch, name))
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2880, 1800])
      expect(png.toString('base64').length).toBeGreaterThan(4194304)
      console.log(JSON.stringify({ backend, width: 2880, height: 1800, pngBytes: png.length }))
    }
    cli(['run', 'game/scenarios/m0-suspension.json'])
    cli(['net'])
    const network = JSON.parse(readFileSync(join(scratch, 'net.json'), 'utf8'))
    expect(typeof network.build).toBe('string')
    expect(network.bytes).toBeGreaterThan(0)
  } finally { cli(['stop']) }
  const result = spawnSync(process.execPath, [join(root, 'game/tools/budget.mjs')], { cwd: root, encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
}, 60000)
