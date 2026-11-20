#!/usr/bin/env node
// The historical M2 runner retains its original default entry and schema-1 expectations.
// Player input, panels, persistence, F8 and device recovery now exercise the M3a default.
// The M3 inventory lists the stores behind Gear & stores.
// Long/Kiln Pleat, M2's detailed damage ledger, three-Creaseback drops and schema-0 input use explicit M2.
// The M1 fight uses its original seed, inputs and hashes on the explicit m1-fight entry.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, args) => i % 2 ? pairs : [...pairs, [arg.replace(/^--/, ''), args[i + 1]]], []))
assert(options.url, 'Usage: m3-regression.mjs --url URL --backend webgpu|webgl --locks both|present|missing')
const url = new URL(options.url)
assert(url.pathname.endsWith('/play/'), '--url must include /play/')
const backend = options.backend ?? 'webgpu', lockMode = options.locks ?? 'both'
assert(['webgpu', 'webgl'].includes(backend)); assert(['both', 'present', 'missing'].includes(lockMode))
const port = Number(process.env.PLAY_CDP_PORT ?? 9606), endpoint = `http://127.0.0.1:${port}`
const out = resolve(options.out ?? `game/.play-out/m3-regression-${backend}`)
mkdirSync(out, { recursive: true })
const checks = [], clients = [], targets = [], diagnostics = []
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let browser, child, profile, seedText
const saveReport = () => writeFileSync(join(out, 'acceptance.json'), JSON.stringify({ url: url.href, backend, locks: lockMode, checks, diagnostics }, null, 2) + '\n')
async function check(name, fn) {
  try { const evidence = await fn(); checks.push({ name, result: 'PASS', evidence }) }
  catch (error) { checks.push({ name, result: 'FAIL', kind: error.code === 'ERR_ASSERTION' ? 'assertion' : 'infrastructure', reason: error.message }) }
  console.log(JSON.stringify(checks.at(-1))); saveReport()
}
async function until(fn, description, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { if (await fn()) return; await delay(40) }
  assert.fail(`Timed out waiting for ${description}`)
}
async function connect(address) {
  const socket = new WebSocket(address), pending = new Map(); let serial = 0
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data), request = pending.get(message.id)
    if (request) {
      pending.delete(message.id); clearTimeout(request.timer)
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown' ||
      (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) ||
      (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level))) {
      diagnostics.push(message)
    }
  }
  const client = { send(method, params = {}) { return new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)) }, 20000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  }) }, close() { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')) }; pending.clear(); socket.close() } }
  clients.push(client); return client
}
async function evaluate(page, expression, awaitPromise = true) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  assert(!exceptionDetails, `Public browser call: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text}`)
  return result?.value
}
async function launch() {
  await new Promise((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(resolve)) })
  profile = mkdtempSync(join(tmpdir(), 'arpg-regression-'))
  child = spawn(process.env.BRAVE_BIN ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
    '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update', '--disable-background-networking',
    '--disable-backgrounding-occluded-windows', '--window-size=1440,900', '--enable-automation', '--headless=new', 'about:blank'
  ], { stdio: 'ignore' })
  let launchedError
  child.on('error', error => { launchedError = error })
  let version
  await until(async () => { if (launchedError) throw launchedError; try { version = await (await fetch(`${endpoint}/json/version`)).json(); return true } catch { return false } }, 'Brave CDP')
  browser = await connect(version.webSocketDebuggerUrl)
}

// Audit native storage and capture actual autosave callbacks; locks are never replaced or simulated.
const bootstrap = (missing, initial, fault) => `(() => {
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  const key='folio.arpg.save';
  if(!sessionStorage.getItem('m2.harness.seeded')){${initial === undefined ? '' : initial === null ? 'nativeRemove.call(localStorage,key);' : `nativeSet.call(localStorage,key,${JSON.stringify(initial)});`}sessionStorage.setItem('m2.harness.seeded','1');}
  window.__m2={boot:performance.timeOrigin,writes:[],timers:[],fault:${JSON.stringify(fault ?? null)}};
  Storage.prototype.getItem=function(k){if(this===localStorage&&k===key&&['read','security'].includes(__m2.fault))throw new DOMException('injected read',__m2.fault==='security'?'SecurityError':'OperationError');return nativeGet.call(this,k)};
  Storage.prototype.setItem=function(k,v){if(this===localStorage){__m2.writes.push({op:'set',key:k,text:String(v)});if(k===key&&__m2.fault==='quota')throw new DOMException('injected quota','QuotaExceededError');}return nativeSet.call(this,k,v)};
  Storage.prototype.removeItem=function(k){if(this===localStorage)__m2.writes.push({op:'remove',key:k});return nativeRemove.call(this,k)};
  __m2.bytes=()=>nativeGet.call(localStorage,key);
  for(const name of ['setInterval','setTimeout']){const native=window[name];window[name]=function(fn,ms,...args){if(ms>=30000&&typeof fn==='function')__m2.timers.push(()=>fn(...args));return native.call(this,fn,ms,...args)}};
  ${missing ? "Object.defineProperty(Navigator.prototype,'locks',{configurable:true,get:()=>undefined});" : ''}
})()`
async function tab({ missing = false, initial, fault, query = {}, hash = '' } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' }); targets.push(targetId)
  const list = await (await fetch(`${endpoint}/json/list`)).json()
  const page = await connect(list.find(t => t.id === targetId).webSocketDebuggerUrl)
  await page.send('Runtime.enable'); await page.send('Page.enable'); await page.send('Log.enable')
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap(missing, initial, fault) })
  const destination = new URL(url); destination.searchParams.set('debug', '1'); destination.searchParams.set('backend', backend); destination.searchParams.set('fresh', '1')
  for (const [k, v] of Object.entries(query)) destination.searchParams.set(k, v)
  destination.hash = hash
  await page.send('Page.navigate', { url: destination.href })
  await until(() => evaluate(page, '!!window.__game'), 'public __game bootstrap')
  await evaluate(page, '__game.ready.then(()=>true)')
  page.targetId = targetId
  return page
}
async function reload(page, control) {
  const before = await evaluate(page, '__m2.boot')
  if (control) await click(page, control)
  else await page.send('Page.reload')
  await until(() => evaluate(page, `!!window.__game && window.__m2?.boot !== ${before}`), 'new document bootstrap')
  await evaluate(page, '__game.ready')
}
async function closeTabs() {
  for (const id of targets.splice(0)) await browser.send('Target.closeTarget', { targetId: id })
}
const state = page => evaluate(page, '__game.state()')
const status = page => evaluate(page, '__game.save.status()')
const bytes = page => evaluate(page, '__m2.bytes()')
const character = world => world.entities.find(e => e.id === world.playerId)?.character
function build(world) { assert(character(world), 'clearing must construct a character'); return character(world) }
async function click(page, name) {
  if (name === '1,0' || name === '2,0') name = '^\\(?' + name.replace(',', ',\\s*') + '\\)?(?:\\s|$)'
  const location = await evaluate(page, `(() => {const rx=new RegExp(${JSON.stringify(name)},'i');const e=[...document.querySelectorAll('button,[role=button]')].find(e=>rx.test(e.getAttribute('aria-label')||e.textContent));if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  assert(location, `visible control /${name}/`)
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...location })
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...location })
}
async function key(page, code, key = code.replace(/^Key/, '').toLowerCase()) {
  const event = { code, key, ...(code === 'Enter' && { windowsVirtualKeyCode: 13 }) }
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...(code === 'Enter' && { text: '\r' }) })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}
const primary = (page, down) => page.send('Input.dispatchMouseEvent', {
  type: down ? 'mousePressed' : 'mouseReleased', button: 'left', buttons: down ? 1 : 0, clickCount: 1, x: 720, y: 450
})
async function holdStamp(page) {
  const zone = await evaluate(page, '__game.zone()')
  assert(zone.ok && zone.value.zoneId === 'm3a-clearing')
  const preview = await evaluate(page, '__game.character.preview({type:"refitWeapon",familyId:"plumbshoe"})')
  assert(preview.ok && preview.value.result.accepted)
  assert.equal(preview.value.loadout[0], 'plinth-blow')
  assert((await evaluate(page, '__game.character.refitWeapon("plumbshoe")')).accepted)
  assert((await evaluate(page, '__game.character.beginEncounter()')).accepted)
  await primary(page, true)
  await evaluate(page, '__game.step(24)')
  const view = await evaluate(page, '__game.observe()')
  assert.equal(view.actors.find(a => a.id === view.playerId).mechanics.held?.eligibleTicks, 24)
}
async function screenshot(page, name) {
  for (const [width, height] of [[1440, 900], [1024, 768]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await evaluate(page, 'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
    const capture = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `${name}-${width}.png`), Buffer.from(capture.data, 'base64'))
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
}
async function newWriter() {
  await closeTabs(); const page = await tab({ initial: null }); build(await state(page))
  await until(async () => (await status(page)).writable, 'writer lock acquisition'); return page
}
async function pair() {
  const a = await newWriter(); await evaluate(a, '__game.pause()')
  assert((await evaluate(a, '__game.save.flush()')).ok, 'A initial save succeeds')
  const b = await tab(); return { a, b }
}
async function staleWrites(page) {
  await evaluate(page, '(async()=>{for(const timer of __m2.timers)await timer();dispatchEvent(new PageTransitionEvent("pagehide"));return __game.save.flush()})()')
}
async function takeover(page) { await click(page, '^Play here$'); await until(async () => (await status(page)).writable, 'takeover commits before enabling play') }
async function saved(page) { const text = await bytes(page); assert(text, 'stored save exists'); return JSON.parse(text) }

try {
  await launch()
  await check('B01 build metadata/backend and M3a default clearing', async () => {
    const { arguments: flags } = await browser.send('Browser.getBrowserCommandLine')
    assert(flags.includes('--headless=new'))
    const page = await tab({ initial: null }); const world = await state(page); build(world)
    assert.equal(world.scenario, 'm3a-clearing'); assert.equal(world.encounter.phase, 'rest')
    assert.equal(await evaluate(page, '__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
    const metadata = await (await fetch(new URL('build.json', url))).json()
    assert.equal(metadata.build, await evaluate(page, '__game.build')); return metadata
  })
  await check('M1 explicit fight matches every frozen checkpoint', async () => {
    await closeTabs()
    const fixture = name => JSON.parse(readFileSync(new URL('../scenarios/' + name + '.json', import.meta.url), 'utf8'))
    const fight = fixture('m1-fight')
    const page = await tab({ query: { scenario: fight.scenario, seed: fight.seed, paused: '1' } })
    await evaluate(page, `window.fightCommands=${JSON.stringify(fixture('m1-fight-commands'))};true`)
    let previous = 0
    for (const [tick, hash] of fight.checkpoints) {
      assert.equal(await evaluate(page, `__game.simulate(fightCommands,${tick - previous})`), hash, 'tick ' + tick)
      previous = tick
    }
    return { checkpoints: fight.checkpoints.length, finalHash: fight.finalHash }
  })
  await check('F8 copies at least 60 seconds of player input including charge release and re-press', async () => {
    const page = await newWriter()
    await evaluate(page, '__game.pause();__game.step(5400)')
    await holdStamp(page)
    await primary(page, false)
    await primary(page, true)
    await evaluate(page, '__game.step(2)')
    const hash = await evaluate(page, '__game.hash()')
    await browser.send('Browser.grantPermissions', { origin: url.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
    await key(page, 'F8', 'F8')
    await until(() => evaluate(page, 'document.querySelector("#toast")?.textContent === "Replay copied"'), 'F8 replay on clipboard')
    const text = await evaluate(page, 'navigator.clipboard.readText()')
    const replay = JSON.parse(gunzipSync(Buffer.from(text, 'base64url')))
    assert(replay.commands.length >= 3600)
    assert(replay.commands.at(-2).releasedButtons & 1)
    assert(replay.commands.at(-1).pressedButtons & 1)
    for (let tick = Math.ceil(replay.start.world.tick / 60) * 60; tick <= replay.hashes.at(-1)[0]; tick += 60) {
      assert(replay.hashes.some(([at]) => at === tick), 'missing hash at ' + tick)
    }
    const stored = await bytes(page)
    assert((await evaluate(page, `__game.loadReplay(${JSON.stringify(text)})`)).ok)
    assert.equal(await evaluate(page, '__game.hash()'), hash)
    assert((await evaluate(page, '__game.save.reset()')).ok)
    assert(!(await evaluate(page, '__game.save.takeOver()')).ok)
    assert.equal(await bytes(page), stored)
    return { ticks: replay.commands.length, checkpoints: replay.hashes.length, hash }
  })
  await check('GPU loss restores exact plain player state and keeps schema 2 writable', async () => {
    const page = await newWriter()
    await evaluate(page, '__game.pause()')
    await holdStamp(page)
    assert((await evaluate(page, '__game.save.flush()')).ok)
    const hash = await evaluate(page, '__game.hash()')
    await evaluate(page, '__game.debug.loseDevice()')
    await until(() => evaluate(page, '[...document.querySelectorAll("button")].some(b=>b.textContent==="Reload")'), 'graphics recovery control')
    await reload(page, '^Reload$')
    assert.equal(await evaluate(page, '__game.hash()'), hash)
    assert((await evaluate(page, '__game.save.flush()')).ok)
    await evaluate(page, '__game.step(1)')
    const resumed = await evaluate(page, '__game.observe()')
    assert.equal(resumed.command.cancelHeld, true)
    assert.equal(resumed.actors.find(actor => actor.id === resumed.playerId).mechanics.held, null)
    assert.equal((await saved(page)).schema, 2)
  })
  await check('F8 checkpoint resumes a latched release through remaining impact pause', async () => {
    const page = await newWriter()
    await evaluate(page, '__game.pause()')
    await holdStamp(page)
    const snapshot = JSON.parse(await evaluate(page, '__game.snapshot()'))
    snapshot.world.entities.find(actor => actor.id === snapshot.world.playerId).impactPauseTicks = 3
    await evaluate(page, `__game.restore(${JSON.stringify(JSON.stringify(snapshot))})`)
    await primary(page, false)
    await evaluate(page, '__game.step(1)')
    const latched = await evaluate(page, '__game.snapshot()')
    const paused = JSON.parse(latched).world
    assert(paused.entities.find(a => a.id === paused.playerId).mechanics.held.releasePending)
    await evaluate(page, `__game.restore(${JSON.stringify(latched)});__game.step(10)`)
    const hash = await evaluate(page, '__game.hash()')
    const text = await evaluate(page, '__game.exportReplay()')
    const replay = JSON.parse(gunzipSync(Buffer.from(text, 'base64url')))
    assert.deepEqual(replay.start.world, paused)
    assert((await evaluate(page, `__game.loadReplay(${JSON.stringify(text)})`)).ok)
    assert.equal(await evaluate(page, '__game.hash()'), hash)
  })
  await check('B02 I/P/K inspect independently suspend clock, release input; confirm records exactly one idle tick', async () => {
    const page = await newWriter()
    for (const code of ['KeyI', 'KeyP', 'KeyK']) {
      await evaluate(page, '__game.resume();document.querySelector("canvas").focus()')
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' }); await key(page, code)
      assert.equal(await evaluate(page, '__game.observe().paused'), true)
      await evaluate(page, '__game.pause();__game.resume()'); assert.equal(await evaluate(page, '__game.observe().paused'), true)
      const before = await state(page); await delay(100); assert.equal((await state(page)).tick, before.tick)
      assert.equal(await evaluate(page, '__game.observe().command?.buttons??0'), 0)
      if (code === 'KeyP') {
        await click(page, '1,0'); await click(page, '^Confirm$')
        assert.equal((await state(page)).tick, before.tick + 1)
        const replay = await evaluate(page, '__game.observe().command'); assert.equal(replay.buttons, 0); assert(replay.operations.some(o => o.type === 'allocate'))
      }
      await evaluate(page, '__game.pause()'); await key(page, code); await evaluate(page, '__game.step(1)')
      assert.deepEqual(await evaluate(page, '__game.observe().command.move'), { x: 0, z: 0 })
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' })
    }
    await screenshot(page, 'panels')
  })
  await check('B03 inventory comparison/full cells/stash and accessible graph edges/search/refund preview', async () => {
    const page = await newWriter()
    const full = await evaluate(page, `(() => {const save=JSON.parse(__game.save.export()),c=save.character;const source=c.items.find(i=>i.id===c.equipment.weapon);for(let n=0;n<60;n++){const item={...structuredClone(source),id:save.nextItemId++};c.items.push(item);c[n<30?'inventory':'stash'].push(item.id)}return JSON.stringify(save)})()`)
    assert((await evaluate(page, `__game.save.import(${JSON.stringify(full)})`)).ok)
    await key(page, 'KeyI')
    await click(page, '^Gear & stores$')
    await until(() => evaluate(page, `[...document.querySelectorAll('.store .section-title')].filter(row =>
      row.innerText.includes('30 / 30')).length === 2`), 'both rendered 30 / 30 counters')
    assert.match(await evaluate(page, 'document.body.innerText'), /inventory[\s\S]*stash/i)
    assert.match(await evaluate(page, 'document.body.innerText'), /compare|equipped/i)
    assert.match(await evaluate(page, 'document.body.innerText'), /30\s*\/\s*30|full/i)
    await screenshot(page, 'inventory'); await key(page, 'KeyI'); await key(page, 'KeyP')
    const before = await state(page)
    const search = await evaluate(page, `(() => {const e=document.querySelector('input[type=search],input[aria-label*=Search]');if(!e)return false;e.value='melee';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
    assert(search, 'graph exposes search'); await click(page, 'melee')
    assert.deepEqual(build(await state(page)).graph.allocations, build(before).graph.allocations)
    assert(await evaluate(page, '!!document.querySelector("svg line,svg path,canvas[aria-label*=graph i]")'), 'actual graph edges/perimeters rendered')
    await screenshot(page, 'graph')
    await click(page, '1,0'); await click(page, '^Confirm$')
    const shown = await evaluate(page, '__game.character.preview({type:"refund",nodeId:"1,0"})')
    assert(shown.ok); await click(page, '1,0'); await click(page, '^Refund$')
    assert.match(await evaluate(page, 'document.body.innerText'), /refund|connected/i)
    await click(page, '^Refund \\d+ points?$')
    assert.equal(build(await state(page)).points, build(before).points)
  })
  await check('B04 drawing handles, click/keyboard/drag preview, illegal folds and Confirm show identical recipe/query numbers', async () => {
    const results = []
    for (const method of ['click', 'keyboard', 'drag']) {
      await closeTabs(); const page = await tab({ query: { scenario: 'm2-clearing' } }); await key(page, 'KeyK'); await click(page, 'Fold Dart')
      const before = build(await state(page))
      assert.match(await evaluate(page, 'document.body.innerText'), /reach[\s\S]*spread[\s\S]*material/i)
      const footprint = () => evaluate(page, `document.querySelector('.blueprint svg')?.getAttribute('aria-label')`)
      await until(async () => (await footprint()) === 'Projectile footprint', 'unfolded drawing')
      assert.match(await evaluate(page, 'document.body.innerText'), /tension|recovery/i)
      const preview = await evaluate(page, '__game.character.preview({type:"setFolds",skillId:"fold-dart",foldIds:["long-pleat"]})')
      assert(preview.ok && preview.value.result.accepted)
      const comparison = preview.value.actions.find(action => action.skillId === 'fold-dart')
      assert(comparison, 'Fold Dart query exposes the proposed recipe')
      const reach = recipe => Number(recipe.footprint.reach.toFixed(5))
      const proposed = `Projectile footprint, current reach ${reach(comparison.before.recipe)} m, proposed reach ${reach(comparison.after.recipe)} m`
      if (method === 'click' || method === 'drag') await click(page, '^Long Pleat$')
      if (method === 'keyboard') {
        assert(await evaluate(page, `(() => {const pattern=[...document.querySelectorAll('.patterns button')].find(b=>b.textContent==='Long Pleat');
          pattern?.focus();return !!pattern && document.activeElement===pattern})()`), 'Long Pleat has keyboard focus')
        await key(page, 'Enter', 'Enter')
      }
      if (method === 'drag') {
        await until(async () => (await footprint()) === proposed, 'selected fold before dragging')
        const handle = await evaluate(page, `(() => {const e=[...document.querySelectorAll('[aria-label],button')].find(e=>/^Reach(?: handle)?$/i.test(e.getAttribute('aria-label')||e.textContent));if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
        assert(handle, 'accessible Reach handle')
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...handle })
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...handle })
        await until(async () => (await footprint()) === 'Projectile footprint', 'Reach pointer down reveals the current footprint')
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: handle.x + 80, y: handle.y })
        await until(async () => (await footprint()) === proposed, 'Reach drag reveals the proposed footprint before release')
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: handle.x + 80, y: handle.y })
      }
      await until(async () => (await footprint()) === proposed, `${method} renders the queried footprint`)
      assert.match(await evaluate(page, 'document.querySelector(".phase-labels").innerText'),
        new RegExp(`Recovery ${comparison.before.recipe.timing.recoveryTicks} → ${comparison.after.recipe.timing.recoveryTicks}`))
      assert.deepEqual(build(await state(page)), before, 'preview has no build mutation')
      await click(page, '^Confirm$')
      assert.deepEqual(build(await state(page)).folds['fold-dart'], ['long-pleat']); results.push(build(await state(page)).folds)
      await click(page, 'Kiln Pleat'); assert.match(await evaluate(page, 'document.body.innerText'), /tension|incompatible/i)
      await screenshot(page, `folds-${method}`)
    }
    assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2])
  })
  await check('B05 damage tooltip vocabulary/stages equals public preview and explains boost addition/multiplier product', async () => {
    await closeTabs(); const page = await tab({ query: { scenario: 'm2-clearing' } }); await click(page, '^Start'); await key(page, 'KeyK'); await click(page, 'Span Cut')
    const text = await evaluate(page, 'document.body.innerText')
    assert.match(text, /boost/i); assert.match(text, /multiplier/i); assert.match(text, /add/i); assert.match(text, /multipl/i)
    assert.doesNotMatch(text, /\b(increased|more|reduced|less) (damage|modifier)\b/i)
    const result = await evaluate(page, '(()=>{const w=__game.state();const t=w.entities.find(e=>e.faction!=="player"&&e.faction!=="neutral"&&e.health>0);return t?__game.damage("span-cut",t.id):null})()')
    assert(result?.ok, 'damage inspector provides real target preview'); assert(text.includes(String(result.value.damage.calculated)))
    await screenshot(page, 'damage-tooltip')
  })
  await check('B06 LMB/RMB/Q/E/R/T priority, W movement, F pickup; editing never attacks behind panel', async () => {
    const page = await newWriter(); await click(page, '^Start'); await key(page, 'KeyI')
    const before = await state(page); await key(page, 'KeyQ'); await delay(80)
    assert.equal((await state(page)).tick, before.tick)
    await key(page, 'KeyI'); await evaluate(page, '__game.pause()')
    const center = await evaluate(page, '(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
    for (const [button, bit] of [['left', 1], ['right', 2]]) {
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button, clickCount: 1, ...center })
      await evaluate(page, '__game.step(1)'); assert((await evaluate(page, '__game.observe().command.buttons')) & bit)
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button, clickCount: 1, ...center })
    }
    for (const [code, bit] of [['KeyQ', 8], ['KeyE', 16], ['KeyR', 32], ['KeyT', 64], ['KeyF', 128]]) {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code.slice(3).toLowerCase() })
      await evaluate(page, '__game.step(1)'); assert((await evaluate(page, '__game.observe().command.buttons')) & bit)
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase() })
    }
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' }); await evaluate(page, '__game.step(1)')
    const command = await evaluate(page, '__game.observe().command'); assert(command.move.x || command.move.z); assert.equal(command.buttons & 127, 0)
  })
  await check('B07 real UI text export/import/reset and populated save survive reload', async () => {
    const page = await newWriter(); await key(page, 'KeyP'); await click(page, '1,0'); await click(page, '^Confirm$'); await key(page, 'KeyP')
    await click(page, 'Copy save|Export')
    await until(() => evaluate(page, '!!document.querySelector("textarea[readonly]")'), 'rendered export text')
    seedText = await evaluate(page, 'document.querySelector("textarea[readonly]").value')
    assert.equal(JSON.parse(seedText).schema, 2)
    const before = build(await state(page))
    assert((await evaluate(page, '__game.character.allocate("2,0")')).accepted)
    assert.notDeepEqual(build(await state(page)), before, 'live character differs from the exported one')
    await click(page, 'Paste save|Import')
    await until(() => evaluate(page, '!!document.querySelector("textarea:not([readonly])")'), 'rendered import field')
    assert(await evaluate(page, `(() => {const e=document.querySelector('textarea:not([readonly])');if(!e)return false;e.value=${JSON.stringify(seedText)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`), 'paste save text control')
    await click(page, '^Import$|^Confirm$')
    await until(() => evaluate(page, 'document.querySelector(".record-copy [role=status]")?.textContent === "Character imported"'), 'UI import completion')
    assert.deepEqual(build(await state(page)), before)
    await evaluate(page, '__game.save.flush()'); await reload(page)
    assert.deepEqual(build(await state(page)), before)
  })

  if (lockMode !== 'missing') {
    await check('L01 real same-origin A/B: A generation g, B paused/blocked, Play here loads A and commits g+1', async () => {
      const { a, b } = await pair(); const before = await saved(a)
      assert.equal((await status(b)).writable, false); assert.equal(await evaluate(b, '__game.observe().paused'), true)
      assert.match(await evaluate(b, 'document.body.innerText'), /Open in another tab/i)
      await takeover(b); const after = await saved(b)
      assert.equal(after.generation, before.generation + 1); assert.deepEqual(after.character, before.character)
      assert.equal((await status(a)).writable, false); await screenshot(b, 'takeover')
    })
    await check('L02 delayed autosave/pagehide/manual stale A cannot revert bytes, generation or character', async () => {
      const { a, b } = await pair()
      await evaluate(a, 'window.__staleTimer=new Promise(resolve=>setTimeout(()=>__game.save.flush().then(resolve),500));true', false)
      await takeover(b)
      assert((await evaluate(b, '__game.character.allocate("1,0")')).accepted)
      assert((await evaluate(b, '__game.save.flush()')).ok)
      const before = await bytes(b); await evaluate(a, '__staleTimer'); await staleWrites(a)
      assert.equal(await bytes(b), before); assert.equal((await status(a)).writable, false)
    })
    await check('L03 repeat takeover/reload races three times, newest build and monotonically increasing generation', async () => {
      const { a, b } = await pair(); let last = await saved(a)
      for (const page of [b, a, b]) {
        await takeover(page); let current = await saved(page)
        assert(current.generation > last.generation); assert.deepEqual(current.character, last.character)
        const old = page === a ? b : a; await staleWrites(old); assert.equal(await bytes(page), JSON.stringify(current))
        await reload(old)
        await staleWrites(old); assert.equal(await bytes(page), JSON.stringify(current))
        last = current
      }
    })
    await check('L04 proposal: pause A after generation check inside commit; B steal waits; B loads A write before committing', async () => {
      const { a, b } = await pair()
      assert(await evaluate(a, 'typeof __game.save.commitBarrier === "function"'), 'Contract proposal: __game.save.commitBarrier arm/reached/release test hook missing in T2.0')
      assert((await evaluate(a, '__game.character.allocate("1,0")')).accepted)
      await evaluate(a, '__game.save.commitBarrier("arm")')
      await evaluate(a, 'window.__pendingSave=__game.save.flush();true', false)
      await until(() => evaluate(a, '__game.save.commitBarrier("reached")'), 'A post-check commit barrier')
      const before = await saved(a)
      assert.notDeepEqual(before.character, build(await state(a)), 'A pending write must contain a distinguishable build')
      await click(b, '^Play here$'); await delay(100)
      assert.equal((await status(b)).writable, false); assert.equal(await bytes(b), await bytes(a))
      await evaluate(a, '__game.save.commitBarrier("release")'); assert((await evaluate(a, '__pendingSave')).ok)
      await until(async () => (await status(b)).writable, 'B takeover after A commits')
      const after = await saved(b); assert.equal(after.generation, before.generation + 2)
      assert.deepEqual(after.character, build(await state(a))); assert.deepEqual(build(await state(b)), after.character)
      const stable = await bytes(b); await staleWrites(a); assert.equal(await bytes(b), stable)
    })
    await check('L05 foreign generation mismatch demotes current writer and preserves latest bytes', async () => {
      const { a, b } = await pair(); const current = await saved(a); current.generation += 3
      await evaluate(b, `localStorage.setItem('folio.arpg.save',${JSON.stringify(JSON.stringify(current))})`)
      const expected = await bytes(b); const result = await evaluate(a, '__game.save.flush()')
      assert.equal(result.ok, false); assert.equal((await status(a)).writable, false); assert.equal(await bytes(b), expected)
    })
    await check('L06 import commits current generation+1, ignoring imported generation; actual writer/commit locks held', async () => {
      const page = await newWriter(); await evaluate(page, '__game.save.flush()'); const before = await saved(page)
      const imported = { ...before, generation: 999999 }
      assert((await evaluate(page, `__game.save.import(${JSON.stringify(JSON.stringify(imported))})`)).ok)
      assert.equal((await saved(page)).generation, before.generation + 1)
      const locks = await evaluate(page, 'navigator.locks.query()'); assert(locks.held.some(l => l.name === 'folio.arpg.writer'))
    })
    for (const fault of ['quota', 'security', 'read']) await check(`L07 separate ${fault} failure preserves bytes and offers copyable text`, async () => {
      const page = await newWriter(); assert((await evaluate(page, '__game.save.flush()')).ok)
      const before = await bytes(page); await evaluate(page, `__m2.fault=${JSON.stringify(fault)}`)
      const result = await evaluate(page, fault === 'quota' ? '__game.save.flush()' : '__game.save.load()')
      assert.equal(result.ok, false); assert.equal(result.reason, fault === 'read' ? 'read-failed' : fault)
      assert.equal(await bytes(page), before); assert.equal(typeof await evaluate(page, '__game.save.export()'), 'string')
      assert.match(await evaluate(page, 'document.body.innerText'), /copy save|save text/i); await screenshot(page, `save-${fault}`)
    })
    await check('L08 actual 30-second autosave and pagehide advance generation, debug scenario/replay never autosaves progression', async () => {
      const page = await newWriter(); await evaluate(page, '__game.pause();__game.save.flush()'); const first = await saved(page)
      await delay(30500); assert((await saved(page)).generation > first.generation)
      await evaluate(page, 'dispatchEvent(new PageTransitionEvent("pagehide"))')
      await until(async () => (await saved(page)).generation > first.generation + 1, 'pagehide transaction')
      await evaluate(page, '__game.scenario("m1-arena",7)'); const before = await bytes(page)
      await staleWrites(page); assert.equal(await bytes(page), before)
    })
  }

  if (lockMode !== 'present') for (const existing of [false, true]) await check(`N01 locks deleted before both bootstraps, ${existing ? 'existing' : 'absent'} save: zero storage mutation and text round trip`, async () => {
    await closeTabs()
    if (existing && !seedText) {
      const seedPage = await tab({ initial: null, missing: true }); seedText = await evaluate(seedPage, '__game.save.export()'); await closeTabs()
    }
    const initial = existing ? seedText : null
    const a = await tab({ missing: true, initial }), b = await tab({ missing: true })
    for (const page of [a, b]) {
      assert.equal(await evaluate(page, 'navigator.locks'), undefined)
      assert.equal((await status(page)).code, 'read-only'); assert.equal((await status(page)).writable, false)
      build(await state(page)); assert.match(await evaluate(page, 'document.body.innerText'), /read.only|copy save|paste save/i)
      const text = await evaluate(page, '__game.save.export()'); assert((await evaluate(page, `__game.save.import(${JSON.stringify(text)})`)).ok)
      await staleWrites(page); await click(page, 'Reset'); await click(page, '^Confirm$|^Reset$')
      assert.equal(await bytes(page), initial); assert.deepEqual(await evaluate(page, '__m2.writes'), [])
    }
    await delay(30500)
    for (const page of [a, b]) { assert.equal(await bytes(page), initial); assert.deepEqual(await evaluate(page, '__m2.writes'), []); await screenshot(page, `missing-locks-${existing}`) }
  })

  if (lockMode !== 'present') await check('N02 missing locks v0 migration preserves pre-existing bytes, text export migrates only in memory', async () => {
    await closeTabs(); const seedPage = await tab({ initial: null, missing: true, query: { scenario: 'm2-clearing' } }); const v1 = JSON.parse(await evaluate(seedPage, '__game.save.export()')); await closeTabs()
    assert.equal(v1.schema, 1)
    const { contentVersion: _v, lootRng: _rng, nextItemId: _id, ...legacy } = v1
    const text = JSON.stringify({ ...legacy, schema: 0 }); const page = await tab({ missing: true, initial: text })
    assert.equal(JSON.parse(await evaluate(page, '__game.save.export()')).schema, 2)
    await staleWrites(page); assert.equal(await bytes(page), text); assert.deepEqual(await evaluate(page, '__m2.writes'), [])
  })
  await check('B08 startup priority explicit debug > verified recovery > save > new; stale writer recovery rejected', async () => {
    const page = await newWriter(); await evaluate(page, '__game.pause();__game.save.flush()'); const stored = await bytes(page)
    await evaluate(page, '__game.scenario("m1-arena",7);__game.pause()')
    const link = await evaluate(page, '__game.link()'), expected = await evaluate(page, '__game.hash()')
    const explicit = await tab({ hash: new URL(link).hash, query: { paused: '1' } }); assert.equal(await evaluate(explicit, '__game.hash()'), expected)
    await evaluate(explicit, '__game.save.flush()'); assert.equal(await bytes(page), stored)
    await evaluate(page, '__game.debug.loseDevice()'); await reload(page, '^Reload$')
    assert.equal(await evaluate(page, '__game.hash()'), expected)
  })
  if (lockMode !== 'missing') await check('B10 stale graphics recovery cannot replace a newer takeover build', async () => {
    const { a, b } = await pair(); await evaluate(a, '__game.pause();__game.debug.loseDevice()')
    await takeover(b); assert((await evaluate(b, '__game.character.allocate("1,0")')).accepted); assert((await evaluate(b, '__game.save.flush()')).ok)
    const current = await saved(b); await reload(a, '^Reload$')
    assert.deepEqual(build(await state(a)), current.character); assert.equal((await status(a)).writable, false)
    const before = await bytes(b); await staleWrites(a); assert.equal(await bytes(b), before)
  })
  if (lockMode !== 'missing') await check('B13 takeover while recovery art loads wins before the first playable frame', async () => {
    const { a, b } = await pair()
    await evaluate(a, '__game.character.beginEncounter();__game.step(12)')
    const committed = await evaluate(a, '__game.save.flush()')
    assert(committed.ok)
    await evaluate(a, '__game.debug.loseDevice()')
    await until(() => evaluate(a, '!!document.querySelector("#graphics-stopped button")'), 'device loss')
    await a.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const native = window.fetch
      window.fetch = async function(request, ...options) {
        if ((request.url ?? String(request)).endsWith('/pack/characters/knight.glb')) {
          await new Promise(resolve => { window.resumeArt = resolve })
        }
        return native.call(this, request, ...options)
      }
    })()` })
    await click(a, '^Reload$')
    await until(() => evaluate(a, 'typeof window.resumeArt === "function"'), 'startup awaiting character art')
    assert((await evaluate(b, '__game.save.takeOver()')).ok)
    assert((await evaluate(b, '__game.character.allocate("1,0")')).accepted)
    assert((await evaluate(b, '__game.save.flush()')).ok)
    const latest = await saved(b)
    assert(latest.generation > committed.status.generation)
    await evaluate(a, 'window.resumeArt()')
    await until(() => evaluate(a, '!!window.__game'), 'revalidated recovery')
    await evaluate(a, '__game.ready')
    assert.equal((await status(a)).writable, false)
    assert.equal(await evaluate(a, '__game.observe().paused'), true)
    assert.deepEqual(build(await state(a)), latest.character)
    await staleWrites(a)
    assert.deepEqual(await saved(b), latest)
  })
  if (lockMode !== 'missing') await check('B11 real Reset restores a fresh character and later save remains valid', async () => {
    const page = await newWriter(); assert((await evaluate(page, '__game.character.allocate("1,0")')).accepted)
    const generation = (await status(page)).generation
    await click(page, '^Reset$'); await click(page, '^Confirm$|^Reset$')
    await until(async () => {
      const text = await bytes(page)
      const current = (await status(page)).generation
      return current > generation && text && JSON.parse(text).generation === current
    }, 'committed Reset generation')
    const fresh = build(await state(page)); assert.equal(fresh.rank, 1); assert.equal(fresh.points, 4); assert.deepEqual(fresh.graph.allocations, [])
    assert((await evaluate(page, '__game.save.flush()')).ok); assert.deepEqual((await saved(page)).character, fresh)
  })
  await check('B12 final kill and whole-trio sector kill keep rest drops collectible; Start displays count and clears remainder', async () => {
    for (const wholeTrio of [false, true]) {
      await closeTabs(); const page = await tab({ query: { scenario: 'm2-clearing' } }); await click(page, '^Start'); await evaluate(page, '__game.pause()')
      const snapshot = await evaluate(page, `(() => {const e=JSON.parse(__game.snapshot()),w=e.world,p=w.entities.find(a=>a.id===w.playerId);p.pos={x:0,z:0};p.action=null;p.previousButtons=0;const enemies=w.entities.filter(a=>a.ai&&a.health>0);if(!${wholeTrio})w.entities=w.entities.filter(a=>!a.ai||a.id===enemies[0].id);for(const [i,a] of enemies.entries()){a.health=1;a.pos=[{x:1,z:0},{x:1.1,z:.7},{x:1.1,z:-.7}][i];a.action=null}w.content.m2.lootTables.forEach(t=>t.dropChance=1);return JSON.stringify(e)})()`)
      await evaluate(page, `__game.restore(${JSON.stringify(snapshot)});__game.cmd({move:{x:0,z:0},aim:{x:10,z:0},buttons:1});__game.step(10)`)
      const rested = await state(page); assert.equal(rested.encounter.phase, 'rest'); assert.equal(rested.groundDrops.length, wholeTrio ? 3 : 1)
      const startLabel = () => evaluate(page, '[...document.querySelectorAll("button")].find(b=>/^Start/i.test(b.textContent))?.textContent')
      await until(async () => (await startLabel())?.includes(`${rested.groundDrops.length} uncollected`), 'rendered Start drop count')
      const label = await startLabel()
      assert(label?.includes(String(rested.groundDrops.length)), 'Start exposes uncollected drop count')
      await evaluate(page, 'document.querySelector("canvas").focus()'); await key(page, 'KeyF'); await evaluate(page, '__game.step(1)')
      assert.equal(build(await state(page)).inventory.length, 1)
      await screenshot(page, `rest-loot-${wholeTrio}`); await click(page, '^Start')
      assert.deepEqual((await state(page)).groundDrops, [])
    }
  })
  await check('B09 corruption/future input preserves stored bytes; visible error and no partial import', async () => {
    const page = await newWriter(); await evaluate(page, '__game.save.flush()'); const stored = await bytes(page), before = build(await state(page))
    for (const text of ['{', JSON.stringify({ format: 'folio.arpg.save', schema: 99 })]) {
      const result = await evaluate(page, `__game.save.import(${JSON.stringify(text)})`); assert.equal(result.ok, false)
      assert.deepEqual(build(await state(page)), before); assert.equal(await bytes(page), stored)
      assert.match(await evaluate(page, 'document.body.innerText'), /corrupt|future|invalid|save/i)
    }
  })
  await check('No gameplay console warnings or exceptions', () => {
    const problems = diagnostics.filter(event =>
      !JSON.stringify(event.params).includes('WebGL: CONTEXT_LOST_WEBGL'))
    assert.deepEqual(problems, [])
  })
} finally {
  if (browser) await closeTabs().catch(() => {})
  for (const client of clients) client.close()
  if (child) { child.kill(); await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]) }
  if (profile) rmSync(profile, { recursive: true, force: true })
  saveReport()
}
console.log(JSON.stringify({ total: checks.length, passed: checks.filter(c => c.result === 'PASS').length, failed: checks.filter(c => c.result === 'FAIL').length, report: join(out, 'acceptance.json') }))
process.exitCode = checks.some(c => c.result === 'FAIL') ? 1 : 0
