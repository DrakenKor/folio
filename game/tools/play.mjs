#!/usr/bin/env node
// Isolated Brave automation over CDP, using only Node 24 built-ins.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../..', import.meta.url))
const defaultOut = join(root, 'game/.play-out')
const sessionFile = join(defaultOut, 'session.json')
const cdpPort = Number(process.env.PLAY_CDP_PORT ?? 9555)
assert(Number.isInteger(cdpPort) && cdpPort > 0 && cdpPort <= 65535, 'PLAY_CDP_PORT must be a valid TCP port')
const endpoint = `http://127.0.0.1:${cdpPort}`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = (command, result) => console.log(JSON.stringify({ command, ...result }))
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const save = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`) }
const args = process.argv.slice(2)
const options = {}
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--')) continue
  const name = args[i].slice(2)
  if (!['scenario', 'snap', 'out-dir'].includes(name) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`)
  options[name] = args[i + 1]
  args.splice(i--, 2)
}
const [command, ...positional] = args
const out = options['out-dir'] ? resolve(options['out-dir']) : defaultOut
const clients = []
let session
let browser
let page
let launched = false
let consoleEntries = []
let requests = new Map()
let mainLoader
const heldKeys = new Set()

async function until(predicate, description, ms = 20000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await predicate()) return
    await sleep(50)
  }
  throw new Error(`Timed out: ${description}`)
}

async function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  const listeners = []
  let id = 0
  let closed
  const fail = error => {
    closed = error
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error) }
    pending.clear()
  }
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
  ws.onclose = event => fail(new Error(`CDP connection closed (${event.code}: ${event.reason})`))
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`Cannot connect: ${url}`)) })
  const client = {
    send(method, params = {}, timeout = 30000) {
      return new Promise((resolve, reject) => {
        if (closed || ws.readyState !== WebSocket.OPEN) { reject(closed ?? new Error('CDP connection is not open')); return }
        const request = ++id
        const timer = setTimeout(() => { pending.delete(request); reject(new Error(`Timed out: ${method}`)) }, timeout)
        pending.set(request, { resolve, reject, timer })
        try { ws.send(JSON.stringify({ id: request, method, params })) } catch (error) { fail(error) }
      })
    },
    on(listener) { listeners.push(listener) },
    close() { ws.close(); fail(new Error('CDP client closed')) }
  }
  clients.push(client)
  return client
}

async function version() {
  try { return await (await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) })).json() } catch { return null }
}

async function attach() {
  session = json(sessionFile)
  const current = await version()
  assert.equal(current?.webSocketDebuggerUrl, session.browserUrl, 'Harness browser unavailable; run stop, then boot')
  browser = await connect(session.browserUrl)
  const targets = await (await fetch(`${endpoint}/json/list`)).json()
  const target = targets.find(target => target.id === session.targetId)
  assert(target, 'Game tab closed; run stop, then boot')
  page = await connect(target.webSocketDebuggerUrl)
  page.on(({ method, params }) => {
    if (method === 'Page.frameNavigated' && !params.frame.parentId) mainLoader = params.frame.loaderId
    if (method === 'Runtime.consoleAPICalled') {
      const text = params.args.map(arg => arg.value ?? arg.description ?? arg.type).join(' ')
      // Vite's transport diagnostics are not game console output.
      if (params.type === 'debug' && text.startsWith('[vite]')) return
      consoleEntries.push({ type: params.type, text })
    }
    if (method === 'Runtime.exceptionThrown') consoleEntries.push({ type: 'error', text: params.exceptionDetails.exception?.description ?? params.exceptionDetails.text })
    if (method === 'Log.entryAdded') consoleEntries.push({ type: params.entry.level, text: params.entry.text, url: params.entry.url })
    if (method === 'Network.responseReceived') requests.set(params.requestId, { url: params.response.url, bytes: params.response.encodedDataLength })
    if (method === 'Network.dataReceived') {
      const request = requests.get(params.requestId)
      if (request) request.bytes += params.encodedDataLength
    }
    if (method === 'Network.loadingFinished') {
      const request = requests.get(params.requestId)
      if (request) request.bytes = params.encodedDataLength
    }
  })
  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await page.send(`${domain}.enable`)
  await page.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.send('Page.bringToFront')
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false })
  // Let resize listeners update projection matrices before pointer coordinates are sampled.
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  consoleEntries.push(...session.console ?? [])
}

async function launch() {
  if (existsSync(sessionFile)) { await attach(); return }
  // Never attach to, or close, a browser that this harness did not launch.
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', () => reject(new Error(`CDP port ${cdpPort} is occupied`)))
    probe.listen(cdpPort, '127.0.0.1', () => probe.close(resolve))
  })
  mkdirSync(defaultOut, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'arpg-play-'))
  const log = openSync(join(defaultOut, 'brave.log'), 'a')
  const child = spawn(process.env.BRAVE_BIN ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
    '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, '--remote-allow-origins=*',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-component-update', '--disable-background-networking',
    // Keep the window visible when other apps cover it, so only tab switches hide the game.
    '--disable-backgrounding-occluded-windows',
    ...(process.env.PLAY_HEADLESS === '1' ? ['--headless=new'] : []),
    '--window-size=1280,800', 'about:blank'
  ], { detached: true, stdio: ['ignore', log, log] })
  closeSync(log)
  let startupError
  child.on('error', error => { startupError = error })
  child.unref()
  try {
    let current
    await until(async () => {
      if (startupError) throw startupError
      if (child.exitCode !== null) throw new Error(`Brave exited: ${child.exitCode}; see game/.play-out/brave.log`)
      current = await version()
      return current
    }, 'Brave CDP')
    const targets = await (await fetch(`${endpoint}/json/list`)).json()
    const target = targets.find(target => target.type === 'page')
    assert(target, 'Brave did not create a tab')
    save(sessionFile, { pid: child.pid, profile, browserUrl: current.webSocketDebuggerUrl, targetId: target.id })
    launched = true
    await attach()
  } catch (error) {
    child.kill()
    rmSync(profile, { recursive: true, force: true })
    rmSync(sessionFile, { force: true })
    throw error
  }
}

async function evaluate(expression, timeout) {
  return remoteResult(await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeout)).value
}

function remoteResult({ result, exceptionDetails }) {
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result
}

async function callOn(objectId, functionDeclaration, values = []) {
  return remoteResult(await page.send('Runtime.callFunctionOn', { objectId, functionDeclaration,
    arguments: values.map(value => ({ value })), awaitPromise: true, returnByValue: true })).value
}

const observe = () => evaluate(`(() => {
  const state = __game.observe();
  return {...state, player:state.actors.find(e => e.id === state.playerId),
    hidden:document.hidden, focused:document.hasFocus(), description:__game.describe()};
})()`)

async function cmd(value) {
  assert(value, 'Usage: cmd <json>')
  const command = typeof value === 'string' ? JSON.parse(value) : value
  await evaluate(`__game.cmd(${JSON.stringify(command)})`)
  report('cmd', { queued: true })
}

async function boot(url, scenario = options.scenario, snap = options.snap) {
  assert(url, 'Usage: boot <url> [--scenario name] [--snap file]')
  await launch()
  const target = new URL(url)
  target.searchParams.set('debug', '1')
  if (!target.searchParams.has('paused')) target.searchParams.set('paused', '1')
  target.searchParams.set('fresh', '1')
  if (scenario) target.searchParams.set('scenario', scenario)
  if (snap) target.hash = `snap=${gzipSync(readFileSync(resolve(snap))).toString('base64url')}`
  // The standalone game has no site icon; avoid an unrelated /favicon.ico 404.
  const icon = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('link[rel~="icon"]')) return;
      const icon = document.createElement('link'); icon.rel = 'icon';
      icon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      document.head.append(icon);
    }, {once:true});
  ` })
  await page.send('Runtime.discardConsoleEntries')
  await page.send('Log.clear')
  consoleEntries = []
  requests = new Map()
  const previousLoader = (await page.send('Page.getFrameTree')).frameTree.frame.loaderId
  const navigation = await page.send('Page.navigate', { url: target.href })
  if (navigation.errorText) throw new Error(navigation.errorText)
  if (!navigation.loaderId) await page.send('Page.reload')
  await until(() => navigation.loaderId ? mainLoader === navigation.loaderId : mainLoader && mainLoader !== previousLoader, 'new game document')
  await until(() => evaluate('!!window.__game').catch(() => false), 'window.__game')
  await evaluate('__game.ready.then(() => true)')
  const build = await evaluate('__game.build')
  assert(typeof build === 'string' && build, 'Game has no build id')
  const network = { build, bytes: [...requests.values()].reduce((total, request) => total + request.bytes, 0), requests: [...requests.values()] }
  await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: icon.identifier })
  session = { ...session, url: target.href, network, console: consoleEntries }
  save(sessionFile, session)
  report('boot', { url: target.href, ...await observe() })
}

async function shot(bookmark, filename = `${bookmark}.png`) {
  assert(bookmark, 'Usage: shot <bookmark> <out.png>')
  await evaluate(`__game.camera.bookmark(${JSON.stringify(bookmark)}); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  const { width, height, ratio } = await evaluate('({width:innerWidth,height:innerHeight,ratio:devicePixelRatio})')
  const canvas = remoteResult(await page.send('Runtime.evaluate', {
    expression: `({canvas:new OffscreenCanvas(${Math.round(width * ratio)},${Math.round(height * ratio)})})`
  })).objectId
  const file = resolve(out, filename)
  try {
    // Bound even incompressible RGBA tiles well below Node WebSocket's 4 MiB reply limit.
    const pixelWidth = Math.round(width * ratio)
    const pixelHeight = Math.round(height * ratio)
    for (let y = 0; y < pixelHeight; y += 512) {
      for (let x = 0; x < pixelWidth; x += 512) {
        const screenshot = await page.send('Page.captureScreenshot', { format: 'png',
          clip: { x: x / ratio, y: y / ratio, width: Math.min(512, pixelWidth - x) / ratio,
            height: Math.min(512, pixelHeight - y) / ratio, scale: 1 } })
        await callOn(canvas, `async function(data,x,y) {
          const image = await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
          this.canvas.getContext('2d').drawImage(image,x,y); image.close();
        }`, [screenshot.data, x, y])
      }
    }
    const length = await callOn(canvas, `async function() {
      const blob = await this.canvas.convertToBlob({type:'image/png'});
      this.data = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
      });
      return this.data.length;
    }`)
    const chunks = []
    for (let offset = 0; offset < length; offset += 512 * 1024) {
      chunks.push(await callOn(canvas, 'function(offset) { return this.data.slice(offset,offset+524288) }', [offset]))
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(chunks.join(''), 'base64'))
  } finally {
    await page.send('Runtime.releaseObject', { objectId: canvas })
  }
  report('shot', { bookmark, file })
}

async function sheet(entity, clip, filename) {
  assert(entity && clip && filename, 'Usage: sheet <entity> <clip> <out.png>')
  const data = await evaluate(`__game.sheet(${JSON.stringify(entity)}, ${JSON.stringify(clip)})`)
  assert(data?.startsWith('data:image/png;base64,'), 'Character sheet did not return a PNG')
  const file = resolve(out, filename)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(data.slice('data:image/png;base64,'.length), 'base64'))
  report('sheet', { entity, clip, file })
}

async function consoleSample(ms = 0, expectEmpty = false) {
  await sleep(duration(ms, 'console milliseconds'))
  consoleEntries = [...new Map(consoleEntries.map(entry => [JSON.stringify(entry), entry])).values()]
  save(join(out, 'console.json'), consoleEntries)
  report('console', { entries: consoleEntries })
  if (expectEmpty) assert.equal(consoleEntries.length, 0, 'Expected an empty game console')
}

async function perf(seconds = 2) {
  const ms = duration(seconds, 'perf seconds') * 1000
  assert(ms > 0, 'Performance sample must be positive')
  const result = await evaluate(`new Promise(resolve => {
    const frames = []; const end = performance.now() + ${ms}; let last;
    function frame(now) {
      if (last !== undefined) frames.push(now - last); last = now;
      if (now < end) requestAnimationFrame(frame);
      else {
        frames.sort((a,b) => a-b);
        const at = p => frames[Math.max(0, Math.ceil(frames.length*p)-1)] ?? 0;
        const canvas = document.querySelector('#stage');
        resolve({frameMs:{median:at(0.5),p95:at(0.95),samples:frames.length},game:__game.perf(),
          viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,bufferWidth:canvas.width,bufferHeight:canvas.height}});
      }
    }
    requestAnimationFrame(frame);
  })`, ms + 10000)
  assert(result.frameMs.samples > 0, 'No animation frames sampled')
  save(join(out, 'perf.json'), result)
  report('perf', result)
}

function net() {
  assert(session.network?.bytes > 0, 'No ready-time network measurement; boot first')
  const result = { url: session.url, ...session.network }
  save(join(out, 'net.json'), result)
  report('net', { build: result.build, bytes: result.bytes, requests: result.requests.length, file: join(out, 'net.json') })
}

function duration(value, label) {
  const number = Number(value)
  assert(Number.isFinite(number) && number >= 0, `Invalid ${label}: ${value}`)
  return number
}

async function key(type, code) {
  assert(/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Space|Arrow(Up|Down|Left|Right)|Escape|Enter|Tab|ShiftLeft|ControlLeft|AltLeft)$/.test(code), `Unsupported key code: ${code}`)
  const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code
  await page.send('Input.dispatchKeyEvent', { type, code, key,
    windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : code === 'Space' ? 32 : code.startsWith('F') ? 111 + Number(code.slice(1)) : undefined })
  if (type === 'keyDown') heldKeys.add(code)
  else heldKeys.delete(code)
}

async function pointer(op, { x, y, button }) {
  assert(Number.isFinite(x) && Number.isFinite(y), 'Pointer needs finite x and y')
  const type = { pointerMove: 'mouseMoved', pointerDown: 'mousePressed', pointerUp: 'mouseReleased' }[op]
  if (op !== 'pointerMove') assert(['left', 'right'].includes(button), 'Pointer button must be left or right')
  await page.send('Input.dispatchMouseEvent', { type, x, y, button: button ?? 'none',
    buttons: op === 'pointerDown' ? button === 'left' ? 1 : 2 : 0, clickCount: op === 'pointerMove' ? 0 : 1 })
  report(op, { x, y, button })
}

async function replay() {
  const before = await observe()
  const origin = await evaluate('location.origin')
  await browser.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
  await evaluate('document.querySelector("#toast")?.remove()')
  await key('keyDown', 'F8'); await key('keyUp', 'F8')
  await until(() => evaluate('document.querySelector("#toast")?.textContent === "Replay copied"'), 'F8 replay clipboard')
  const text = await evaluate('navigator.clipboard.readText()')
  const result = await evaluate(`__game.loadReplay(${JSON.stringify(text)})`)
  assert.deepEqual(result, { ok: true }, 'F8 replay did not verify')
  const after = await observe()
  assert.equal(after.hash, before.hash, 'F8 replay final hash differs')
  assert.equal(after.tick, before.tick)
  report('replay', { ...result, tick: after.tick, hash: after.hash, bytes: text.length })
}

async function background(seconds) {
  const ms = duration(seconds, 'background seconds') * 1000
  await evaluate('__game.resume()')
  let other
  try {
    // Focus emulation also forces visibility, so suspend it for a real hidden tab.
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: false })
    other = await browser.send('Target.createTarget', { url: 'about:blank', background: true })
    const before = await observe()
    await browser.send('Target.activateTarget', { targetId: other.targetId })
    await until(() => evaluate('document.hidden'), 'game tab hidden')
    const hidden = await observe()
    await sleep(ms)
    const end = await observe()
    assert(end.tick - before.tick <= 4, 'More than four ticks advanced during backgrounding')
    assert.equal(end.tick, hidden.tick, 'Simulation advanced while hidden')
    report('background', { seconds, beforeTick: before.tick, hiddenTick: hidden.tick, endTick: end.tick })
  } finally {
    if (other) await browser.send('Target.closeTarget', { targetId: other.targetId })
    // The closing tab can stay active briefly; retry until the game tab is really visible again.
    await until(async () => { await page.send('Page.bringToFront'); return evaluate('!document.hidden') }, 'game tab visible')
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  }
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await evaluate('__game.pause()')
  const returned = await observe()
  await evaluate('__game.step(10)')
  const still = await observe()
  assert.deepEqual(still.player.pos, returned.player.pos, 'Held input survived backgrounding')
  assert.deepEqual(still.player.vel, { x: 0, z: 0 })
  report('background-return', { released: true, player: still.player.pos })
}

async function blur(ms = 250) {
  duration(ms, 'blur milliseconds')
  const snapshot = await evaluate('__game.pause(); __game.snapshot()')
  // A child game models the folio iframe: moving focus to its parent blurs
  // the game document even when Brave is headless or another app is in front.
  const focus = remoteResult(await page.send('Runtime.evaluate', { expression: `(() => {
    const previous = document.activeElement;
    const frame = document.createElement('iframe');
    const outside = document.createElement('input');
    frame.style.cssText = 'position:fixed;left:-10000px;width:1px;height:1px';
    outside.style.cssText = 'position:fixed;left:-10000px';
    document.body.append(outside);
    return {frame,outside,previous};
  })()` })).objectId
  const child = expression => callOn(focus, `function() {
    const game = this.frame.contentWindow.__game;
    const document = this.frame.contentDocument;
    ${expression}
  }`)
  const state = () => child(`const world = game.state();
    return {tick:world.tick,player:world.entities.find(e=>e.id===world.playerId),
      hidden:document.hidden,focused:document.hasFocus(),description:game.describe()};`)
  try {
    await callOn(focus, `async function() {
      await new Promise((resolve,reject) => {
        this.frame.onload = resolve; this.frame.onerror = () => reject(new Error('Blur frame failed to load'));
        const url = new URL(location.href); url.hash = ''; url.searchParams.set('paused','1');
        this.frame.src = url.href; document.body.append(this.frame);
      });
    }`)
    await until(() => child('return !!game'), 'iframe game')
    await child('return game.ready.then(()=>true)')
    await callOn(focus, `function(snapshot) {
      const game = this.frame.contentWindow.__game; game.restore(snapshot);
      this.frame.contentWindow.focus(); this.frame.contentDocument.querySelector('canvas').focus();
    }`, [snapshot])
    for (const code of heldKeys) await key('keyDown', code)
    await child('game.resume(); game.step(1)')
    const running = await state()
    assert(running.description.includes('running'), 'Iframe game did not resume before blur')
    if ([...heldKeys].some(code => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code))) {
      assert(Math.hypot(running.player.vel.x, running.player.vel.z) > 0, 'Held movement did not reach the iframe game')
    }
    await callOn(focus, 'function() { this.outside.focus() }')
    const before = await state()
    assert.equal(before.hidden, false, 'Blur check requires a visible game')
    assert.equal(before.focused, false, 'Game did not lose focus inside the page')
    assert(before.description.includes('paused'), 'Game did not pause on blur')
    await sleep(ms)
    assert.equal((await state()).tick, before.tick, 'Simulation advanced while blurred')
    await child('game.step(10)')
    const after = await state()
    assert.deepEqual(after.player.pos, before.player.pos, 'Held input survived blur')
    assert.deepEqual(after.player.vel, { x: 0, z: 0 })
    report('blur', { tick: before.tick, hidden: before.hidden, focused: before.focused, released: true })
  } finally {
    try {
      await callOn(focus, 'function() { this.frame.remove(); this.outside.remove(); window.focus(); this.previous?.focus() }')
    } finally { await page.send('Runtime.releaseObject', { objectId: focus }) }
  }
}

async function run(file) {
  assert(file, 'Usage: run <script.json>')
  const script = json(resolve(file))
  if (script.url) await boot(script.url, options.scenario ?? script.scenario, options.snap ?? script.snap)
  else await attach()
  if (script.scenario) await evaluate(`__game.pause(); __game.scenario(${JSON.stringify(script.scenario)}, ${script.seed ?? 1})`)
  assert(Array.isArray(script.steps), 'Script requires a steps array')
  for (const [index, step] of script.steps.entries()) {
    try {
      switch (step.op) {
        case 'moveTo': {
          assert(Number.isFinite(step.x) && Number.isFinite(step.z), 'moveTo needs finite x and z')
          const result = await evaluate(`(async () => {
            __game.pause(); let arrived; const moving = __game.agent.moveTo(${step.x}, ${step.z}).then(value => { arrived = value });
            for (let i = 0; i < 600 && arrived === undefined; i++) { __game.step(1); await Promise.resolve(); }
            await moving; return {arrived, tick:__game.state('tick')};
          })()`)
          assert.equal(result.arrived, true, 'moveTo did not reach its target within 600 ticks')
          report('moveTo', result)
          break
        }
        case 'wait':
          assert(Number.isSafeInteger(step.ticks) && step.ticks >= 0, 'wait needs nonnegative integer ticks')
          await evaluate(`__game.pause(); __game.step(${step.ticks})`)
          report('wait', { ticks: step.ticks, tick: await evaluate('__game.state("tick")') })
          break
        case 'shot': await shot(step.bookmark, step.out); break
        case 'eval': {
          assert.equal(typeof step.expression, 'string', 'eval needs an expression')
          const value = await evaluate(step.expression)
          if (Object.hasOwn(step, 'expect')) assert.deepEqual(value, step.expect)
          report('eval', { value })
          break
        }
        case 'expectHash': {
          const hash = await evaluate('__game.hash()')
          assert.equal(hash, step.hash, 'State hash differs')
          report('expectHash', { hash })
          break
        }
        case 'keyDown': case 'keyUp': await key(step.op, step.code); report(step.op, { code: step.code }); break
        case 'pointerMove': case 'pointerDown': case 'pointerUp': await pointer(step.op, step); break
        case 'cmd': await cmd(step.command); break
        case 'observe': report('observe', await observe()); break
        case 'replay': await replay(); break
        case 'background': await background(step.seconds); break
        case 'blur': await blur(step.ms); break
        case 'console': await consoleSample(step.ms ?? 0, step.expectEmpty ?? false); break
        case 'perf': await perf(step.seconds); break
        case 'net': net(); break
        default: throw new Error(`Unknown step: ${step.op}`)
      }
    } catch (error) { throw new Error(`Step ${index + 1} (${step.op}): ${error.message}`, { cause: error }) }
  }
  save(join(out, 'run.json'), { script: resolve(file), result: 'PASS', ...await observe() })
  report('run', { result: 'PASS', script: file })
}

async function stop() {
  if (!existsSync(sessionFile)) { report('stop', { result: 'No harness browser' }); return }
  const saved = json(sessionFile)
  const current = await version()
  if (current) {
    assert.equal(current.webSocketDebuggerUrl, saved.browserUrl, `Port ${cdpPort} belongs to a different browser; refusing to close it`)
    const client = browser ?? await connect(saved.browserUrl)
    await client.send('Browser.close')
    await until(async () => !(await version()), 'Brave shutdown')
    await until(() => {
      try { process.kill(saved.pid, 0); return false } catch (error) { if (error.code === 'ESRCH') return true; throw error }
    }, 'Brave process exit')
  }
  assert(saved.profile.startsWith(join(tmpdir(), 'arpg-play-')), 'Unexpected temporary profile path')
  rmSync(saved.profile, { recursive: true, force: true })
  rmSync(sessionFile, { force: true })
  report('stop', { result: 'Brave stopped; temporary profile removed' })
}

try {
  if (command === 'boot') await boot(positional[0])
  else if (command === 'run') await run(positional[0])
  else if (command === 'stop') await stop()
  else if (command === 'sheet') { await attach(); await sheet(...positional) }
  else if (['shot', 'console', 'perf', 'net', 'cmd', 'observe'].includes(command)) {
    await attach()
    if (command === 'shot') await shot(...positional)
    if (command === 'console') await consoleSample(positional[0] ?? 0)
    if (command === 'perf') await perf(positional[0] ?? 2)
    if (command === 'net') net()
    if (command === 'cmd') await cmd(positional[0])
    if (command === 'observe') report('observe', await observe())
  } else throw new Error('Usage: play.mjs boot|run|cmd <json>|observe|shot|sheet|console|perf|net|stop [args] [--out-dir directory]')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
  if (launched) await stop().catch(error => console.error(`Cleanup: ${error.message}`))
} finally {
  for (const client of clients) client.close()
}
