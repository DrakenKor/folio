import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

// Run against the brief's Vite server and isolated Brave instance on port 9555.
const endpoint = `http://127.0.0.1:${process.argv[2] ?? 9555}`
const origin = 'http://localhost:5176'
const scriptFile = fileURLToPath(new URL('./acceptance-script.json', import.meta.url))
const script = JSON.parse(readFileSync(scriptFile, 'utf8'))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const clients = []
const report = (check, result) => process.stdout.write(`${JSON.stringify({ check, ...result })}\n`)

async function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  const listeners = []
  let id = 0
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    const request = pending.get(message.id)
    if (request) {
      pending.delete(message.id)
      clearTimeout(request.timer)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result)
    } else for (const listener of listeners) listener(message)
  }
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const client = {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const request = ++id
        const timer = setTimeout(() => { pending.delete(request); reject(new Error(`Timed out: ${method}`)) }, 20000)
        pending.set(request, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: request, method, params }))
      })
    },
    on(listener) { listeners.push(listener) },
    close() { ws.close() }
  }
  clients.push(client)
  return client
}

const targets = await (await fetch(`${endpoint}/json`)).json()
const target = targets.find(candidate => candidate.type === 'page' && candidate.url.includes(origin)) ?? targets.find(candidate => candidate.type === 'page')
assert(target, 'Brave needs a page target')
const version = await (await fetch(`${endpoint}/json/version`)).json()
const browser = await connect(version.webSocketDebuggerUrl)
const page = await connect(target.webSocketDebuggerUrl)
const exceptions = []
const warnings = []
page.on(message => {
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') warnings.push(message.params.args)
})
let loads = 0
page.on(message => { if (message.method === 'Page.loadEventFired') loads++ })
await page.send('Page.enable')
await page.send('Runtime.enable')
await page.send('Page.bringToFront')
await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })

async function evaluate(expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result.value
}
async function waitFor(predicate, description) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await sleep(50)
  }
  throw new Error(`Timed out: ${description}`)
}
async function navigate(url) {
  const previous = loads
  const navigation = await page.send('Page.navigate', { url })
  if (!navigation.loaderId) await page.send('Page.reload')
  await waitFor(() => loads > previous, 'page load')
  await page.send('Page.bringToFront')
  await waitFor(() => evaluate('!!window.__game'), 'debug API')
  await evaluate('__game.ready.then(() => true)')
}
const state = () => evaluate('({tick:__game.state("tick"),hash:__game.hash(),player:__game.state("entities.0"),description:__game.describe(),hidden:document.hidden,focused:document.hasFocus()})')
const key = (code, type = 'keyDown') => page.send('Input.dispatchKeyEvent', { type, code, key: code === 'KeyW' ? 'w' : code, windowsVirtualKeyCode: code === 'KeyW' ? 87 : 119 })

try {
  await navigate(`${origin}/play/?debug=1&paused=1&fresh=1`)
  await evaluate(`__game.scenario('meadow-start', 7); __game.simulate(${JSON.stringify(script)}, 137)`)
  const snapshot = await state()
  const link = await evaluate('__game.link()')
  await navigate(link)
  assert.equal((await state()).hash, snapshot.hash)
  report(1, { result: 'PASS', tick: snapshot.tick, hash: snapshot.hash, fragmentBytes: link.length })

  const node = JSON.parse(execFileSync('npm', ['run', '--silent', 'game:sim', '--', '--scenario', 'meadow-start', '--seed', '7', '--ticks', '3600', '--script', scriptFile], { encoding: 'utf8' }))
  const hash = await evaluate(`__game.scenario('meadow-start', 7); __game.simulate(${JSON.stringify(script)}, 3600)`)
  assert.equal(hash, node.hash)
  report(2, { result: 'PASS', node, braveHash: hash })

  await browser.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
  await key('F8')
  await key('F8', 'keyUp')
  await waitFor(() => evaluate('document.querySelector("#toast")?.textContent === "Replay copied"'), 'F8 clipboard')
  const replay = await evaluate('navigator.clipboard.readText()')
  const replayData = JSON.parse(gunzipSync(Buffer.from(replay, 'base64url')).toString())
  assert.equal(replayData.build, await evaluate('__game.build'))
  assert.equal(replayData.commands.length, 3600)
  const replayEnd = await state()
  const verified = await evaluate(`__game.scenario('empty', 1); __game.loadReplay(${JSON.stringify(replay)})`)
  assert.deepEqual(verified, { ok: true })
  assert.equal((await state()).hash, replayEnd.hash)
  assert.equal((await state()).tick, replayEnd.tick)
  report(3, { result: 'PASS', verified, tick: replayEnd.tick, hash: replayEnd.hash, replayBytes: replay.length, build: replayData.build, f8: 'Replay copied' })

  await browser.send('Browser.setPermission', { origin, permission: { name: 'clipboard-write' }, setting: 'denied' })
  await key('F8')
  await key('F8', 'keyUp')
  await waitFor(() => evaluate('document.querySelector("#toast")?.textContent.includes("Clipboard refused")'), 'clipboard refusal')
  assert(warnings.some(args => args[0]?.value === 'Replay:' && args[1]?.value === replay))
  report('clipboard-refusal', { result: 'PASS', toast: 'Clipboard refused. Replay logged in console.' })

  // Remove the explicit fragment and fresh flag so this tests pagehide storage.
  await evaluate('history.replaceState(null, "", "/play/?debug=1&paused=1")')
  const beforeReload = await state()
  await navigate(`${origin}/play/?debug=1&paused=1`)
  const afterReload = await state()
  assert.equal(afterReload.tick, beforeReload.tick)
  assert.equal(afterReload.hash, beforeReload.hash)
  report(4, { result: 'PASS', tick: afterReload.tick, hash: afterReload.hash })

  await evaluate('__game.scenario("meadow-start", 7); __game.resume()')
  await key('KeyW')
  await sleep(200)
  const moving = await state()
  assert(moving.player.vel.z < 0, 'W must move before backgrounding')
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: false })
  const other = await browser.send('Target.createTarget', { url: 'about:blank' })
  await browser.send('Target.activateTarget', { targetId: other.targetId })
  await waitFor(() => evaluate('document.hidden'), 'background tab')
  const hidden = await state()
  await sleep(10000)
  const hiddenEnd = await state()
  assert(hiddenEnd.tick - hidden.tick <= 4)
  assert(hiddenEnd.tick - moving.tick <= 4)
  await browser.send('Target.closeTarget', { targetId: other.targetId })
  await page.send('Page.bringToFront')
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await sleep(200)
  await evaluate('__game.pause()')
  const returned = await state()
  await evaluate('__game.step(10)')
  const still = await state()
  assert.deepEqual(still.player.pos, returned.player.pos)
  assert.deepEqual(still.player.vel, { x: 0, z: 0 })
  report(5, { result: 'PASS', hiddenMs: 10000, before: moving.tick, hidden: hidden.tick, after: hiddenEnd.tick, still: still.player.pos })

  // A visible iframe models focus leaving the game for its folio shell.
  await evaluate(`{
    const frame = document.createElement('iframe'); frame.id = 'focus-frame';
    frame.src = '/play/?debug=1&paused=1&fresh=1';
    frame.style.cssText = 'position:fixed;inset:0;width:80%;height:80%';
    const outside = document.createElement('input'); outside.id = 'outside-focus';
    outside.style.cssText = 'position:fixed;right:0;top:0';
    document.body.append(frame, outside);
  }`)
  const child = expression => evaluate(`(async()=>{const frame=document.querySelector('#focus-frame'); const game=frame.contentWindow.__game; ${expression}})()`)
  await waitFor(() => child('return !!game'), 'iframe game')
  await child('await game.ready; frame.contentWindow.focus(); frame.contentDocument.querySelector("canvas").focus(); game.resume()')
  await key('KeyW')
  await sleep(200)
  assert((await child('return game.state("entities.0.vel.z")')) < 0)
  await evaluate('document.querySelector("#outside-focus").focus()')
  const blurred = await child('return {tick:game.state("tick"),hidden:frame.contentDocument.hidden,focused:frame.contentDocument.hasFocus(),description:game.describe()}')
  assert.equal(blurred.hidden, false)
  assert.equal(blurred.focused, false)
  assert(blurred.description.includes('paused'))
  await sleep(200)
  assert.equal(await child('return game.state("tick")'), blurred.tick)
  const blurPosition = await child('return game.state("entities.0.pos")')
  await child('game.step(10)')
  assert.deepEqual(await child('return game.state("entities.0.pos")'), blurPosition)
  await evaluate('document.querySelector("#focus-frame").remove(); document.querySelector("#outside-focus").remove()')
  report(6, { result: 'PASS', pausedTick: blurred.tick, hidden: blurred.hidden, focused: blurred.focused, released: true })

  for (const backend of ['webgpu', 'webgl']) {
    await navigate(`${origin}/play/?debug=1&paused=1&fresh=1&backend=${backend}`)
    assert.equal(await evaluate('__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
    await evaluate('__game.scenario("meadow-start", 7); __game.step(42)')
    await key('KeyW')
    await evaluate('__game.step(1)')
    assert((await state()).player.vel.z < 0)
    await evaluate('__game.resume()')
    assert((await state()).description.includes('running'))
    await evaluate('__game.debug.loseDevice()')
    await waitFor(() => evaluate('!!document.querySelector("#graphics-stopped button")'), 'graphics overlay')
    const stopped = await state()
    await sleep(300)
    assert.equal((await state()).tick, stopped.tick)
    const image = await page.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`/tmp/t03-loss-${backend}.png`, Buffer.from(image.data, 'base64'))
    const previousLoads = loads
    await evaluate('document.querySelector("#graphics-stopped button").click()')
    await waitFor(() => loads > previousLoads, 'graphics reload')
    await waitFor(() => evaluate('!!window.__game'), 'restored API')
    await evaluate('__game.ready.then(() => true)')
    const restored = await state()
    assert.equal(restored.tick, stopped.tick)
    assert.equal(restored.hash, stopped.hash)
    await evaluate('__game.step(1)')
    assert.deepEqual((await state()).player.pos, restored.player.pos)
    assert.deepEqual((await state()).player.vel, { x: 0, z: 0 })
    report(7, { result: 'PASS', backend, tick: restored.tick, hash: restored.hash, reload: true, released: true })
  }

  await evaluate('__game.scenario("meadow-start", 7); __game.teleport(-20, 0); __game.resume()')
  const arrived = await evaluate('__game.agent.moveTo(-40, 0)')
  assert.equal(arrived, true)
  await sleep(2100)
  const perf = await evaluate('__game.perf()')
  assert.equal(perf.frameMs.samples, 120)
  const observed = await state()
  await evaluate('__game.pause(); __game.camera.bookmark("player")')
  await sleep(100)
  const playerImage = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync('/tmp/t03-platform-player.png', Buffer.from(playerImage.data, 'base64'))
  await evaluate('__game.pause(); __game.camera.bookmark("overview")')
  await sleep(100)
  const screenshot = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync('/tmp/t03-platform-overview.png', Buffer.from(screenshot.data, 'base64'))
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions))
  report('extra', { result: 'PASS', moveTo: arrived, player: observed.player.pos, perf, runtimeExceptions: exceptions.length, warnings: warnings.length })
} finally {
  for (const client of clients) client.close()
}
