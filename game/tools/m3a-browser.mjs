#!/usr/bin/env node
// Real UI/storage and real Web Locks in one isolated Brave profile. No dependencies.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, args) => i % 2 ? pairs : [...pairs, [arg.replace(/^--/, ''), args[i + 1]]], []))
assert(options.url, 'Usage: m3a-browser.mjs --url URL --backend webgpu|webgl --locks both|present|missing')
const url = new URL(options.url)
assert(url.pathname.endsWith('/play/'), '--url must include /play/')
const backend = options.backend ?? 'webgpu', lockMode = options.locks ?? 'both'
assert(['webgpu', 'webgl'].includes(backend))
assert(['both', 'present', 'missing'].includes(lockMode))
const port = Number(process.env.PLAY_CDP_PORT ?? 9600), endpoint = `http://127.0.0.1:${port}`
const out = resolve(options.out ?? `game/.play-out/m3a-${backend}`)
mkdirSync(out, { recursive: true })
const checks = [], clients = [], targets = [], diagnostics = []
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let browser, child, profile
const saveReport = () => writeFileSync(join(out, 'acceptance.json'), JSON.stringify({ url: url.href, backend, locks: lockMode, checks, diagnostics }, null, 2) + '\n')
async function check(name, fn) {
  try {
    const evidence = await fn()
    checks.push({ name, result: 'PASS', evidence })
  }
  catch (error) { checks.push({ name, result: 'FAIL', kind: error.code === 'ERR_ASSERTION' ? 'assertion' : 'infrastructure', reason: error.message }) }
  console.log(JSON.stringify(checks.at(-1)))
  saveReport()
}
async function until(fn, description, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await fn()) return
    await delay(40)
  }
  assert.fail(`Timed out waiting for ${description}`)
}
async function connect(address) {
  const socket = new WebSocket(address), pending = new Map()
  let serial = 0
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data), request = pending.get(message.id)
    if (request) {
      pending.delete(message.id)
      clearTimeout(request.timer)
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result)
    } else if (['Runtime.exceptionThrown', 'Log.entryAdded', 'Runtime.consoleAPICalled'].includes(message.method)) {
      if (message.method !== 'Runtime.consoleAPICalled' || ['error', 'warning'].includes(message.params.type)) diagnostics.push(message)
    }
  }
  const client = {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial, timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`CDP timeout ${method}`))
        }, 20000)
        pending.set(id, { resolve, reject, timer })
        socket.send(JSON.stringify({ id, method, params }))
      })
    }, close() {
      for (const p of pending.values()) {
        clearTimeout(p.timer)
        p.reject(new Error('CDP closed'))
      }
      ;
      pending.clear()
      socket.close()
    }
  }
  clients.push(client)
  return client
}
async function evaluate(page, expression, awaitPromise = true) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  assert(!exceptionDetails, `Public browser call: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text}`)
  return result?.value
}
async function launch() {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
  profile = mkdtempSync(join(tmpdir(), 'arpg-m3a-'))
  child = spawn(process.env.BRAVE_BIN ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
    '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update', '--disable-background-networking',
    '--disable-backgrounding-occluded-windows', '--window-size=1440,900', '--enable-automation', '--headless=new', 'about:blank'
  ], { stdio: 'ignore' })
  let launchedError
  child.on('error', error => { launchedError = error })
  let version
  await until(async () => {
    if (launchedError) throw launchedError
    try {
      version = await (await fetch(`${endpoint}/json/version`)).json()
      return true
    } catch { return false }
  }, 'Brave CDP')
  browser = await connect(version.webSocketDebuggerUrl)
}

// Audit native storage and capture actual autosave callbacks; locks are never replaced or simulated.
const bootstrap = (missing, initial, fault) => `(() => {
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  const key='folio.arpg.save';
  if(!sessionStorage.getItem('m3a.harness.seeded')){${initial === undefined ? '' : initial === null ? 'nativeRemove.call(localStorage,key);' : `nativeSet.call(localStorage,key,${JSON.stringify(initial)});`}sessionStorage.setItem('m3a.harness.seeded','1');}
  window.__qa={boot:performance.timeOrigin,writes:[],timers:[],fault:${JSON.stringify(fault ?? null)}};
  Storage.prototype.getItem=function(k){if(this===localStorage&&k===key&&['read','security'].includes(__qa.fault))throw new DOMException('injected read',__qa.fault==='security'?'SecurityError':'OperationError');return nativeGet.call(this,k)};
  Storage.prototype.setItem=function(k,v){if(this===localStorage){__qa.writes.push({op:'set',key:k,text:String(v)});if(k===key&&__qa.fault==='quota')throw new DOMException('injected quota','QuotaExceededError');}return nativeSet.call(this,k,v)};
  Storage.prototype.removeItem=function(k){if(this===localStorage)__qa.writes.push({op:'remove',key:k});return nativeRemove.call(this,k)};
  const clear=Storage.prototype.clear;Storage.prototype.clear=function(){if(this===localStorage)__qa.writes.push({op:'clear'});return clear.call(this)};
  __qa.bytes=()=>nativeGet.call(localStorage,key);
  for(const name of ['setInterval','setTimeout']){const native=window[name];window[name]=function(fn,ms,...args){if(ms>=30000&&typeof fn==='function')__qa.timers.push(()=>fn(...args));return native.call(this,fn,ms,...args)}};
  ${missing ? "Object.defineProperty(Navigator.prototype,'locks',{configurable:true,get:()=>undefined});" : ''}
})()`
async function tab({ missing = false, initial, fault, query = {}, hash = '' } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  targets.push(targetId)
  const list = await (await fetch(`${endpoint}/json/list`)).json()
  const page = await connect(list.find(t => t.id === targetId).webSocketDebuggerUrl)
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Log.enable')
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap(missing, initial, fault) })
  const destination = new URL(url)
  destination.searchParams.set('paused', '1')
  destination.searchParams.set('backend', backend)
  destination.searchParams.set('fresh', '1')
  for (const [k, v] of Object.entries(query)) destination.searchParams.set(k, v)
  destination.hash = hash
  await page.send('Page.navigate', { url: destination.href })
  await until(() => evaluate(page, '!!window.__game'), 'public __game bootstrap')
  await evaluate(page, '__game.ready.then(()=>true)')
  page.targetId = targetId
  return page
}
async function reload(page, control) {
  const before = await evaluate(page, '__qa.boot')
  if (control) await click(page, control)
  else await page.send('Page.reload')
  await until(() => evaluate(page, `!!window.__game && window.__qa?.boot !== ${before}`), 'new document bootstrap')
  await evaluate(page, '__game.ready')
}
async function closeTabs() {
  for (const id of targets.splice(0)) await browser.send('Target.closeTarget', { targetId: id })
}
const state = page => evaluate(page, '__game.state()')
const status = page => evaluate(page, '__game.save.status()')
const bytes = page => evaluate(page, '__qa.bytes()')
const character = world => world.entities.find(e => e.id === world.playerId)?.character

async function click(page, name) {
  if (name === '1,0' || name === '2,0') name = '^\\(?' + name.replace(',', ',\\s*') + '\\)?(?:\\s|$)'
  const location = await evaluate(page, `(() => {const rx=new RegExp(${JSON.stringify(name)},'i');const e=[...document.querySelectorAll('button,[role=button]')].find(e=>{if(!rx.test(e.getAttribute('aria-label')||e.textContent)||e.disabled)return false;const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  assert(location, `visible control /${name}/`)
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...location })
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...location })
}
async function key(page, code, key = code.replace(/^Key/, '').toLowerCase()) {
  const event = { code, key, ...(code === 'Enter' && { windowsVirtualKeyCode: 13 }) }
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...(code === 'Enter' && { text: '\r' }) })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}
async function screenshot(page, name) {
  for (const [width, height] of [[1440, 900], [1024, 768]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await evaluate(page, 'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
    const capture = await page.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(out, `${name}-${width}.png`), Buffer.from(capture.data, 'base64'))
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
}
async function newWriter(initial = null) {
  await closeTabs()
  const page = await tab({ initial })
  assert(character(await state(page)))
  await until(async () => (await status(page)).writable, 'writer lock acquisition')
  return page
}
async function pair(initial) {
  const a = await newWriter(initial)
  await evaluate(a, '__game.pause()')
  assert((await evaluate(a, '__game.save.flush()')).ok, 'A initial save succeeds')
  const b = await tab()
  return { a, b }
}
async function staleWrites(page) {
  await evaluate(page, '(async()=>{for(const timer of __qa.timers)await timer();dispatchEvent(new PageTransitionEvent("pagehide"));return __game.save.flush()})()')
}
async function takeover(page) {
  await click(page, '^Play here$')
  await until(async () => (await status(page)).writable, 'takeover commits before enabling play')
}
async function saved(page) {
  const text = await bytes(page)
  assert(text, 'stored save exists')
  return JSON.parse(text)
}

const legacy = readFileSync(new URL('../scenarios/m3a-save-v1.json', import.meta.url), 'utf8').trim()
const paint = page => evaluate(page, 'new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(true))))')
const body = page => evaluate(page, 'document.body.innerText')
const observe = page => evaluate(page, '__game.observe()')
const advance = (page, count) => evaluate(page, `__game.step(${count})`)
const physical = (page, code, down) => page.send('Input.dispatchKeyEvent', {
  type: down ? 'keyDown' : 'keyUp', code, key: code === 'Space' ? ' ' : code.slice(3).toLowerCase()
})
async function mouse(page, down) {
  const point = await evaluate(page, '(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+r.width*.52,y:r.y+r.height*.5}})()')
  await page.send('Input.dispatchMouseEvent', { type: down ? 'mousePressed' : 'mouseReleased', button: 'left', buttons: down ? 1 : 0, ...point })
}
async function replay(page) {
  const expected = await evaluate(page, '__game.hash()')
  const result = await evaluate(page, '__game.exportReplay().then(text=>__game.loadReplay(text))')
  assert(result.ok, 'recorded physical inputs replay')
  assert.equal(await evaluate(page, '__game.hash()'), expected)
}
async function refit(page, family) {
  await key(page, 'KeyI')
  await paint(page)
  await click(page, family)
  await click(page, '^Confirm')
  await key(page, 'KeyI')
  await paint(page)
}
async function chargeRoom() {
  const page = await newWriter()
  // M2 already exposes Plinth on its player. Exercise the sampler on the baseline as well.
  if ((await state(page)).build === 'm2-sim-v2') {
    const result = await evaluate(page, '__game.character.setLoadout(["plinth-blow",null,null,null,null,null])')
    assert(result.accepted)
  } else await refit(page, 'Plumbshoe')
  assert.equal(character(await state(page)).loadout[0], 'plinth-blow')
  await click(page, '^Start')
  await evaluate(page, '__game.pause()')
  // A real opponent remains in stamp range. Disable its AI in the initial snapshot.
  await evaluate(page, `(()=>{const s=JSON.parse(__game.snapshot()),w=s.world,p=w.entities.find(a=>a.id===w.playerId),enemy=w.entities.find(a=>a.ai);
    if(!enemy)return false;enemy.pos={x:p.pos.x+1,z:p.pos.z};enemy.ai=null;
    for(const other of w.entities.filter(a=>a.ai))other.pos={x:p.pos.x+8,z:p.pos.z+2};
    __game.restore(JSON.stringify(s));return true})()`).then(ok => assert(ok, 'a damageable opponent is present'))
  return page
}
async function renderedCopy(page) {
  await paint(page)
  await click(page, '^Copy save(?: text)?$|^Export$')
  await until(() => evaluate(page, '!!document.querySelector("textarea[readonly]")'), 'copyable current text')
  return JSON.parse(await evaluate(page, 'document.querySelector("textarea[readonly]").value'))
}
try {
  await launch()
  await check('B01 headless process, requested backend, plain player entry and painted family bindings', async () => {
    const flags = await browser.send('Browser.getBrowserCommandLine')
    assert(flags.arguments.includes('--headless=new'))
    const page = await newWriter()
    await paint(page)
    assert.equal(await evaluate(page, '__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
    await screenshot(page, 'shelter')
    assert.deepEqual(character(await state(page)).loadout, ['span-cut', 'open-hem', 'fold-dart', 'rill-fan', null, null])
    assert.match(await body(page), /Open Hem/i)
  })
  await check('B02 capture-phase suppression blocks a real dodge, identical unsuppressed key produces dodge', async () => {
    const page = await newWriter()
    await click(page, '^Start')
    await evaluate(page, '__game.pause();document.querySelector("canvas").focus()')
    await evaluate(page, 'window.addEventListener("keydown", e=>e.stopImmediatePropagation(),{capture:true,once:true})')
    await key(page, 'Space', ' ')
    const blocked = await advance(page, 1)
    assert.equal((await observe(page)).command.buttons & 4, 0)
    assert(!blocked.some(e => e.type === 'dodge'))
    await key(page, 'Space', ' ')
    assert((await advance(page, 1)).some(e => e.type === 'dodge'))
    await replay(page)
  })
  await check('B03 DOM release then re-press between samples records UP then DOWN', async () => {
    const page = await newWriter()
    await click(page, '^Start')
    await evaluate(page, '__game.pause()')
    await mouse(page, true)
    await advance(page, 1)
    const start = (await observe(page)).tick
    await mouse(page, false)
    await mouse(page, true)
    assert.equal((await observe(page)).tick, start)
    await advance(page, 1)
    const up = (await observe(page)).command.buttons & 1
    await advance(page, 1)
    assert.deepEqual([up, (await observe(page)).command.buttons & 1], [0, 1])
    await replay(page)
  })
  for (const pauseTicks of [0, 3]) await check(`B04 charged release/re-press, impact pause ${pauseTicks}, exact discharge replay`, async () => {
    const page = await chargeRoom()
    await mouse(page, true)
    await advance(page, 24)
    if (pauseTicks) {
      // Preserve the physical hold across restore by re-establishing it before sampling.
      await mouse(page, false)
      await evaluate(page, `(()=>{const s=JSON.parse(__game.snapshot());s.world.entities.find(a=>a.id===s.world.playerId).impactPauseTicks=${pauseTicks + 1};__game.restore(JSON.stringify(s))})()`)
      await mouse(page, true)
      await advance(page, 1)
    }
    const start = await observe(page), victim = start.actors.find(a => a.id !== start.playerId && !a.ai)
    assert(victim, 'stamp target')
    await mouse(page, false)
    await mouse(page, true)
    assert.equal((await observe(page)).tick, start.tick)
    const commands = [], events = [], at = await evaluate(page, '__game.snapshot()')
    for (let i = 0; i < 12; i++) {
      events.push(...await advance(page, 1))
      commands.push((await observe(page)).command)
    }
    assert.deepEqual(commands.slice(0, 2).map(c => c.buttons & 1), [0, 1])
    const hits = events.filter(e => e.type === 'damage' && e.targetId === victim.id && e.skillId === 'plinth-blow')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].amount, 42)
    assert.equal(hits[0].tick, start.tick + pauseTicks + 5)
    assert.equal((await observe(page)).actors.find(a => a.id === victim.id).health, victim.health - 42)
    await paint(page)
    await screenshot(page, 'charged-' + pauseTicks)
    await replay(page)
    const repeated = await evaluate(page, `(()=>{__game.restore(${JSON.stringify(at)});return ${JSON.stringify(commands)}.flatMap(c=>{__game.cmd(c);return __game.step(1)})})()`)
    assert.deepEqual(repeated, events)
  })
  for (const reason of ['blur', 'hidden', 'panel', 'dodge', 'device']) await check('B05 held stamp cancellation ' + reason, async () => {
    const page = await chargeRoom()
    await mouse(page, true)
    await advance(page, 24)
    if (reason === 'panel') {
      await key(page, 'KeyI')
      await key(page, 'KeyI')
    }
    if (reason === 'hidden') {
      await page.send('Emulation.setFocusEmulationEnabled', { enabled: false })
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
      targets.push(targetId)
      await browser.send('Target.activateTarget', { targetId })
      await until(() => evaluate(page, 'document.hidden'), 'background tab visibility')
      await browser.send('Target.activateTarget', { targetId: page.targetId })
      await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
      await until(() => evaluate(page, '!document.hidden'), 'playable tab visibility')
    }
    if (reason === 'blur') await evaluate(page, 'dispatchEvent(new Event("blur"));dispatchEvent(new Event("focus"))')
    if (reason === 'device') {
      await evaluate(page, '__game.debug.loseDevice()')
      await reload(page, '^Reload$')
    }
    if (reason === 'dodge') await key(page, 'Space', ' ')
    const events = await advance(page, 1), cmd = (await observe(page)).command
    if (reason === 'dodge') assert(events.some(e => e.type === 'dodge'))
    else assert.equal(cmd.cancelHeld, true)
    await mouse(page, false)
    assert(!(await advance(page, 30)).some(e => e.type === 'damage' && e.skillId === 'plinth-blow'))
    await replay(page)
  })
  await check('B06 editor predicts six damage, renders changed paths, costs and conditional payoff', async () => {
    const page = await newWriter()
    await key(page, 'KeyK')
    await click(page, 'Fold Dart')
    await click(page, '^Through Pleat$')
    await click(page, '^Confirm$')
    await click(page, '^Splay Pleat$')
    await paint(page)
    const text = await body(page)
    assert.match(text, /\b6\b/)
    assert.match(text, /tension/i)
    assert(await evaluate(page, '!!document.querySelector(".blueprint svg path, .blueprint svg line")'))
    await screenshot(page, 'fold-price')
    await click(page, '^Confirm$')
    assert.deepEqual(character(await state(page)).folds['fold-dart'].sort(), ['splay-pleat', 'through-pleat'])
    await click(page, 'Lift Print')
    assert.match(await body(page), /Emberprint/i)
    assert.match(await body(page), /16/)
  })
  await check('B09 DOM refit previews and equips all four families in a full migrated store', async () => {
    const page = await newWriter(legacy)
    const before = character(await state(page))
    for (const [family, skill] of [['Plumbshoe', 'plinth-blow'], ['Verge Reel', 'cast-loop'], ['Hearth Frame', 'lay-bed'], ['Hemblade', 'span-cut']]) {
      await refit(page, family)
      await paint(page)
      const current = character(await state(page))
      assert.equal(current.equipment.weapon, before.equipment.weapon)
      assert.deepEqual(current.stash, before.stash)
      assert.equal(current.loadout[0], skill)
      assert.match(await body(page), new RegExp(skill.replace('-', ' '), 'i'))
    }
  })
  for (const cue of ['charged stamp', 'brace whiff', 'park and recall', 'leave echo']) await check('B10 motion capture ' + cue, async () => {
    const page = await newWriter()
    if (cue === 'park and recall') await refit(page, 'Verge Reel')
    else if (cue === 'charged stamp' || cue === 'brace whiff') await refit(page, 'Plumbshoe')
    else assert((await evaluate(page, '__game.character.setFolds("span-cut",["after-pleat"])')).accepted, 'After Pleat is available')
    await click(page, '^Start')
    await evaluate(page, '__game.pause();document.querySelector("canvas").focus()')
    // Sample the actual pointer ray and build one stationary, unarmoured fixture target on it.
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800, y: 450 })
    await advance(page, 1)
    const fixture = await evaluate(page, `(()=>{const aim=__game.observe().command.aim,s=JSON.parse(__game.snapshot()),w=s.world,p=w.entities.find(e=>e.id===w.playerId);
      const v=w.entities.find(e=>e.ai);if(!aim||!v)return null;const dx=aim.x-p.pos.x,dz=aim.z-p.pos.z,len=Math.hypot(dx,dz);v.ai=null;v.action=null;v.health=v.maxHealth=500;
      v.pos={x:p.pos.x+dx/len,z:p.pos.z+dz/len};
      w.entities=w.entities.filter(e=>e===p||e===v||e.ai);for(const e of w.entities.filter(e=>e.ai))e.pos={x:p.pos.x+9,z:p.pos.z+2};
      __game.restore(JSON.stringify(s));return {target:v.id,x:dx/len,z:dz/len}})()`)
    assert(fixture, 'sampled ground point and active hostile target')
    const pointer = (down, button) => page.send('Input.dispatchMouseEvent', { type: down ? 'mousePressed' : 'mouseReleased', button, buttons: down ? (button === 'left' ? 1 : 2) : 0, x: 800, y: 450, clickCount: 1 })
    const right = cue === 'brace whiff', button = right ? 'right' : 'left'
    await pointer(true, button)
    const prefix = await advance(page, cue === 'charged stamp' ? 24 : cue === 'park and recall' ? 54 : cue === 'brace whiff' ? 6 : 7)
    assert(prefix.some(e => e.type === 'action'))
    await paint(page)
    await screenshot(page, cue + '-before')
    await pointer(false, button)
    if (cue === 'park and recall') {
      await pointer(true, 'right')
      await advance(page, 1)
      await pointer(false, 'right')
    }
    if (cue === 'leave echo') {
      // Fork immediately after the first paid contact with an outward moving target.
      await evaluate(page, `(()=>{const s=JSON.parse(__game.snapshot()),v=s.world.entities.find(e=>e.id===${fixture.target});
        v.knockback={vel:{x:${fixture.x}*9,z:${fixture.z}*9},remainingTicks:18};__game.restore(JSON.stringify(s))})()`)
    }
    const events = await advance(page, 55)
    const damage = events.filter(e => e.type === 'damage' && e.targetId === fixture.target && e.skillId !== 'emberprint')
    const expected = { 'charged stamp': [42], 'brace whiff': [], 'park and recall': [24], 'leave echo': [] }
    assert.deepEqual(damage.map(e => e.amount), expected[cue])
    if (cue === 'leave echo') assert(prefix.some(e => e.type === 'damage' && e.amount === 12))
    if (cue === 'park and recall') assert(prefix.some(e => e.type === 'damage' && e.amount === 18))
    await paint(page)
    await screenshot(page, cue + '-after')
    await replay(page)
  })
  if (lockMode !== 'missing') {
    await check('S08 boot, import and direct projection produce identical receipts and canonical current data', async () => {
      const script = `
        const {loadCharacter,exportCharacter}=require('./game/src/sim/core');
        const {clearing}=require('./game/scenarios/m3a-profile');
        const {format,schema,generation,build,...data}=require('./game/scenarios/m3a-save-v1.json');
        const result=loadCharacter(data,clearing().content);
        process.stdout.write(JSON.stringify({data:exportCharacter(result.world),refunds:result.refunds}));
      `
      const direct = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '-e', script], { encoding: 'utf8' }))
      const a = await newWriter(legacy), boot = await status(a), text = await evaluate(a, '__game.save.export()')
      const { format, schema, generation, build, ...data } = JSON.parse(text)
      assert.equal(format, 'folio.arpg.save')
      assert(build)
      assert.deepEqual(boot.refunds, direct.refunds)
      assert.deepEqual(data, direct.data)
      const b = await newWriter()
      const imported = await evaluate(b, `__game.save.import(${JSON.stringify(legacy)})`)
      assert(imported.ok)
      assert.deepEqual(imported.status.refunds, direct.refunds)
      assert.deepEqual(character(await state(b)), direct.data.character)
      await evaluate(b, '__game.save.load()')
      assert.deepEqual((await status(b)).refunds, [])
      assert.equal(schema, 2)
      assert.equal(generation, JSON.parse(legacy).generation + 1)
    })
    await check('S06 migration on import inside commit, native takeover retains repaired character and one receipt', async () => {
      const { a, b } = await pair(), start = await saved(a)
      await evaluate(a, '__game.save.commitBarrier("arm")')
      await evaluate(a, `window.pending=__game.save.import(${JSON.stringify(legacy)});true`)
      await until(() => evaluate(a, '__game.save.commitBarrier("reached")'), 'A migrating inside commit')
      await click(b, '^Play here$')
      await until(async () => (await evaluate(b, 'navigator.locks.query()')).pending.some(l => l.name === 'folio.arpg.commit'), 'B waiting on migration')
      await evaluate(a, '__game.save.commitBarrier("release")')
      const imported = await evaluate(a, 'pending')
      assert(imported.ok)
      await until(async () => (await status(b)).writable, 'B acquired migrated character')
      const latest = await saved(b)
      assert.equal(latest.generation, start.generation + 2)
      assert.deepEqual(latest.character, character(await state(a)))
      assert.deepEqual(latest.character, character(await state(b)))
      assert.deepEqual((await status(b)).refunds, [])
      assert.equal(latest.character.stash.length, 30)
      const stable = await bytes(b)
      await staleWrites(a)
      assert.equal(await bytes(b), stable)
      assert.equal(latest.schema, 2)
      assert(imported.status.refunds.some(s => s.includes('hush-pleat')))
    })
    await check('S07 exact UTF-8 and UTF-16 caps accept inclusive input and reject first excess before commit', async () => {
      const page = await newWriter()
      assert((await evaluate(page, '__game.save.flush()')).ok)
      for (const encoding of ['utf8', 'utf16']) {
        const result = await evaluate(page, `(async()=>{
          const save=JSON.parse(__game.save.export());save.build='';
          const base=JSON.stringify(save),limit=1048576,bytes=new TextEncoder();
          if('${encoding}'==='utf16')save.build='a'.repeat(limit/2-base.length)
          else {const left=limit-bytes.encode(base).length;save.build='界'.repeat(Math.floor(left/3))+'a'.repeat(left%3)}
          const exact=JSON.stringify(save),accepted=await __game.save.import(exact),stored=__qa.bytes();
          save.build+='a';const excess=await __game.save.import(JSON.stringify(save));
          return {size:'${encoding}'==='utf16'?exact.length*2:bytes.encode(exact).length,accepted:accepted.ok,reason:excess.reason,unchanged:__qa.bytes()===stored}
        })()`)
        assert.deepEqual(result, { size: 1048576, accepted: true, reason: 'oversize', unchanged: true })
      }
    })
    await check('S01 migrated writer paused inside commit, takeover reads latest, stale autosave and pagehide cannot revert', async () => {
      const { a, b } = await pair(legacy), first = await saved(a)
      assert.equal((await status(b)).writable, false)
      // A full stash still permits an edit, leaving a distinguishable pending projection.
      const change = await evaluate(a, '__game.character.refund("6,0")')
      assert(change.accepted)
      await evaluate(a, '__game.save.commitBarrier("arm");window.pending=__game.save.flush();true')
      await until(() => evaluate(a, '__game.save.commitBarrier("reached")'), 'A inside native commit lock')
      await evaluate(a, 'for(const timer of __qa.timers)timer();dispatchEvent(new PageTransitionEvent("pagehide"))')
      await click(b, '^Play here$')
      await until(async () => (await evaluate(b, 'navigator.locks.query()')).pending.some(l => l.name === 'folio.arpg.commit'), 'B waits for real commit lock')
      assert.equal((await status(b)).writable, false)
      await evaluate(a, '__game.save.commitBarrier("release")')
      assert((await evaluate(a, 'pending')).ok)
      await until(async () => (await status(b)).writable, 'B commits latest')
      const latest = await saved(b)
      assert.equal(latest.generation, first.generation + 2)
      assert.deepEqual(latest.character, character(await state(a)))
      assert.deepEqual(character(await state(b)), latest.character)
      const stable = await bytes(b)
      await staleWrites(a)
      assert.equal(await bytes(b), stable)
      assert.equal(latest.schema, 2)
    })
    for (const fault of ['quota', 'read']) await check('S02 copied current character after ' + fault, async () => {
      const page = await newWriter()
      assert((await evaluate(page, '__game.save.flush()')).ok)
      const stored = await bytes(page)
      assert((await evaluate(page, '__game.character.allocate("1,0")')).accepted)
      await evaluate(page, `__qa.fault=${JSON.stringify(fault)}`)
      const result = await evaluate(page, fault === 'quota' ? '__game.save.flush()' : '__game.save.load()')
      assert.equal(result.reason, fault === 'quota' ? 'quota' : 'read-failed')
      assert.equal(await bytes(page), stored)
      const copied = await renderedCopy(page)
      assert.deepEqual(copied.character, character(await state(page)))
    })
    await check('S03 corrupt, future, oversize, broken ownership reject before replacing bytes or character', async () => {
      const page = await newWriter()
      await evaluate(page, '__game.save.flush()')
      const before = await bytes(page), world = await evaluate(page, '__game.hash()'), broken = JSON.parse(before)
      broken.character.inventory.push(broken.character.equipment.weapon)
      for (const [input, reason] of [['{', 'corrupt'], [JSON.stringify({ ...broken, schema: 99 }), 'future-schema'], [' '.repeat(524289), 'oversize'], [JSON.stringify(broken), 'invalid-character']]) {
        const result = await evaluate(page, `__game.save.import(${JSON.stringify(input)})`)
        assert.equal(result.reason, reason)
        assert.equal(await bytes(page), before)
        assert.equal(await evaluate(page, '__game.hash()'), world)
      }
    })
    await check('S04 replay and explicit scenario cannot autosave, stale graphics recovery yields to newer writer', async () => {
      const player = await newWriter()
      await evaluate(player, '__game.save.flush()')
      const playerBytes = await bytes(player)
      await replay(player)
      assert((await evaluate(player, '__game.character.allocate("1,0")')).accepted)
      await staleWrites(player)
      assert.equal(await bytes(player), playerBytes)
      const { a, b } = await pair(), stored = await bytes(a)
      const debug = await tab({ query: { scenario: 'm1-arena' } })
      await replay(debug)
      await staleWrites(debug)
      assert.equal(await bytes(a), stored)
      await evaluate(a, '__game.debug.loseDevice()')
      await until(async () => /Reload/.test(await body(a)), 'lost device')
      await takeover(b)
      assert((await evaluate(b, '__game.character.allocate("1,0")')).accepted)
      assert((await evaluate(b, '__game.save.flush()')).ok)
      const latest = await bytes(b)
      await reload(a, '^Reload$')
      assert.deepEqual(character(await state(a)), JSON.parse(latest).character)
      await staleWrites(a)
      assert.equal(await bytes(b), latest)
    })
  }
  if (lockMode !== 'present') for (const schema of [0, 1]) await check('S05 no Web Locks at bootstrap, schema ' + schema + ' import/reset/migration never writes', async () => {
    await closeTabs()
    const seed = JSON.parse(legacy)
    seed.schema = schema
    if (!schema) {
      delete seed.contentVersion
      delete seed.lootRng
      delete seed.nextItemId
    }
    const initial = JSON.stringify(seed), a = await tab({ missing: true, initial }), b = await tab({ missing: true })
    const versions = []
    for (const page of [a, b]) {
      assert.equal(await evaluate(page, 'navigator.locks'), undefined)
      assert.equal((await status(page)).code, 'read-only')
      const migrated = JSON.parse(await evaluate(page, '__game.save.export()'))
      assert((await evaluate(page, `__game.save.import(${JSON.stringify(initial)})`)).ok)
      await staleWrites(page)
      await click(page, '^Reset$')
      await click(page, '^Confirm$|^Reset$')
      await paint(page)
      assert.equal(await bytes(page), initial)
      assert.deepEqual(await evaluate(page, '__qa.writes'), [])
      assert.deepEqual(migrated.lootRng, JSON.parse(legacy).lootRng)
      assert.equal(migrated.nextItemId, JSON.parse(legacy).nextItemId)
      versions.push(migrated.schema)
    }
    assert.deepEqual(versions, [2, 2])
  })
  await check('B08 real F collects the nearby item and dead actors ignore physical attacks and dodge', async () => {
    const page = await newWriter()
    await click(page, '^Start')
    await evaluate(page, '__game.pause()')
    const item = await evaluate(page, `(()=>{const s=JSON.parse(__game.snapshot()),w=s.world,p=w.entities.find(a=>a.id===w.playerId);
      const item={...structuredClone(p.character.items[0]),id:w.nextItemId++};w.groundDrops.push({item,pos:{...p.pos}});__game.restore(JSON.stringify(s));return item.id})()`)
    await evaluate(page, 'document.querySelector("canvas").focus()')
    await key(page, 'KeyF')
    await advance(page, 1)
    assert(character(await state(page)).inventory.includes(item))
    await evaluate(page, `(()=>{const s=JSON.parse(__game.snapshot()),w=s.world,p=w.entities.find(a=>a.id===w.playerId);
      p.health=0;p.action=null;p.death={startTick:w.tick,ageTicks:0,despawnAfterTicks:null};w.encounter.phase='defeat';__game.restore(JSON.stringify(s))})()`)
    await mouse(page, true)
    await physical(page, 'Space', true)
    const events = await advance(page, 12), view = await observe(page)
    assert(!events.some(e => e.id === view.playerId && e.type === 'action' || e.actorId === view.playerId && e.type === 'dodge'))
    assert.equal(view.command.buttons, 0)
    await paint(page)
    assert.match(await body(page), /return|defeat/i)
  })
  await check('B07 gameplay console has zero warnings or errors', () => {
    const problems = diagnostics.filter(d => d.method === 'Runtime.exceptionThrown' ||
      (d.method === 'Runtime.consoleAPICalled' && !/WebGL: CONTEXT_LOST_WEBGL/.test(JSON.stringify(d.params.args))) ||
      (d.method === 'Log.entryAdded' && ['warning', 'error'].includes(d.params.entry.level) && d.params.entry.source === 'javascript'))
    assert.deepEqual(problems.map(d => d.params.exceptionDetails?.text ?? d.params.entry?.text ?? d.params.args?.map(a => a.value)), [])
  })
} finally {
  if (browser) await closeTabs().catch(() => { })
  for (const client of clients) client.close()
  if (child) {
    child.kill()
    await Promise.race([new Promise(done => child.once('exit', done)), delay(5000)])
  }
  if (profile) rmSync(profile, { recursive: true, force: true })
  saveReport()
}
const failed = checks.filter(c => c.result === 'FAIL')
console.log(JSON.stringify({ total: checks.length, failed: failed.length, backend }))
process.exitCode = Number(failed.length > 0)
