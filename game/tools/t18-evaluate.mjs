// Integration evidence through the existing CLI and public debug boundary.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { restoreFixtures } from './t18-fixtures.ts'

const [build, backend, mode = 'acceptance'] = process.argv.slice(2)
assert(['dev', 'static'].includes(build) && ['webgpu', 'webgl'].includes(backend), 'Usage: t18-evaluate.mjs dev|static webgpu|webgl [acceptance|perf]')
const origin = build === 'dev' ? 'http://127.0.0.1:5198' : 'http://127.0.0.1:8798'
const out = resolve(['perf', 'artifacts'].includes(mode) ? `game/.play-out/t18/${backend}` : `game/.play-out/t18/${build}-${backend}${mode === 'recovery' ? '/recovery' : ''}`)
mkdirSync(out, { recursive: true })
const env = { ...process.env, PLAY_CDP_PORT: '9578', PLAY_HEADLESS: '1' }
const checks = []
let sequence = 0
const cli = (...args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['game/tools/play.mjs', ...args, '--out-dir', out], { env })
  let stdout = '', stderr = ''
  child.stdout.on('data', bytes => { stdout += bytes })
  child.stderr.on('data', bytes => { stderr += bytes })
  child.on('error', reject)
  child.on('close', code => {
    appendFileSync(join(out, 'play.log'), stdout + stderr)
    if (code) reject(new Error(`${args.slice(0, 2).join(' ')}: ${stderr || stdout.slice(-2000)}`))
    else resolve(stdout)
  })
})
async function run(steps) {
  const file = join(out, `script-${++sequence}.json`)
  writeFileSync(file, JSON.stringify({ steps }))
  return cli('run', file)
}
async function check(name, fn) {
  if (mode === 'recovery' && !['backend', 'combat graphics loss and Reload', 'console warnings/errors'].includes(name)) return
  try { checks.push({ name, result: 'PASS', evidence: await fn() }) }
  catch (error) { checks.push({ name, result: 'FAIL', reason: error.message }) }
  writeFileSync(join(out, 'acceptance.json'), JSON.stringify({ build, backend, mode, checks }, null, 2))
  console.log(JSON.stringify({ build, backend, ...checks.at(-1) }))
}
let socket
const pending = new Map()
const diagnostics = []
let id = 0
async function attach() {
  const session = JSON.parse(readFileSync('game/.play-out/session.json', 'utf8'))
  const targets = await (await fetch('http://127.0.0.1:9578/json/list')).json()
  socket = new WebSocket(targets.find(target => target.id === session.targetId).webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const request = pending.get(message.id)
      if (!request) return
      pending.delete(message.id)
      clearTimeout(request.timer)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown' ||
      message.method === 'Runtime.consoleAPICalled' && ['warning', 'warn', 'error'].includes(message.params.type) ||
      message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) diagnostics.push(message)
  }
  socket.onclose = () => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP closed')) }; pending.clear() }
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  // Keep the harness icon across the Reload check on this persistent CDP session.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded',()=>{
    const icon=document.createElement('link');icon.rel='icon';icon.href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';document.head.append(icon);
  },{once:true})` })
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const number = ++id
    const timer = setTimeout(() => { pending.delete(number); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
    pending.set(number, { resolve, reject, timer })
    socket.send(JSON.stringify({ id: number, method, params }))
  })
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result.value
}
const paint = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn) {
  for (let i = 0; i < 400; i++) { if (await fn().catch(() => false)) return; await delay(50) }
  throw new Error('Game did not become ready')
}
async function uploadImage(file, name) {
  const data = readFileSync(join(out, file)).toString('base64')
  await evaluate(`window.${name}=''`)
  for (let offset = 0; offset < data.length; offset += 524288) await evaluate(`window.${name}+=${JSON.stringify(data.slice(offset, offset + 524288))};true`)
}
async function compare(a, b) {
  await uploadImage(a, '__t18ImageA'); await uploadImage(b, '__t18ImageB')
  return evaluate(`(async()=>{
    const images=await Promise.all([__t18ImageA,__t18ImageB].map(async data=>createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob())));
    const canvas=new OffscreenCanvas(images[0].width,images[0].height),ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=images.map(image=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data});
    let changed=0;for(let i=0;i<pixels[0].length;i+=4)if([0,1,2,3].some(c=>pixels[0][i+c]!==pixels[1][i+c]))changed++;
    images.forEach(image=>image.close());return {changed,pixels:canvas.width*canvas.height,percent:changed/(canvas.width*canvas.height)*100};
  })()`)
}
async function montage(files, cols, rows, filename) {
  for (let i = 0; i < files.length; i++) await uploadImage(files[i], `__t18Tile${i}`)
  await run([{ op: 'image', out: filename, expression: `(async()=>{
    const canvas=document.createElement('canvas');canvas.width=${cols}*540;canvas.height=${rows}*360;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#142129';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const [i,name] of ${JSON.stringify(files)}.entries()){
      const bytes=Uint8Array.from(atob(window['__t18Tile'+i]),c=>c.charCodeAt(0));
      const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
      const x=i%${cols}*540,y=Math.floor(i/${cols})*360;ctx.drawImage(image,x,y,540,337.5);image.close();
      ctx.fillStyle='#f3f4eb';ctx.font='14px system-ui';ctx.fillText(name.replace('.png',''),x+8,y+354);
    }return canvas.toDataURL('image/png');})()` }])
}
try {
  const start = performance.now()
  await cli('boot', `${origin}/play/?backend=${backend}&scenario=m1-fight&seed=7`)
  await attach()
  const browser = await send('Browser.getVersion')
  writeFileSync(join(out, 'browser.json'), JSON.stringify({ browser, bootMs: performance.now() - start, origin }, null, 2))
  await check('backend', async () => {
    assert.equal(await evaluate('__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
    return browser.product
  })
  if (['perf', 'artifacts'].includes(mode)) {
    const scenario = JSON.parse(readFileSync('game/scenarios/m1-fight-browser.json', 'utf8'))
    const frames = Object.fromEntries(scenario.steps.filter(step => step.op === 'shot').map(step => {
      const match = /fixed\/(.*)-(\d+)\.png/.exec(step.out)
      return [match[1], Number(match[2])]
    }))
    await check('warmed normal-clock fight', async () => {
      if (mode === 'perf') await run([{ op: 'fight', script: 'game/scenarios/m1-fight-commands.json', expected: 'game/scenarios/m1-fight.json', frames, warmupTicks: 600 }])
      const perf = JSON.parse(readFileSync(join(out, 'fight-perf.json'), 'utf8'))
      if (mode === 'perf') for (const name of Object.keys(frames)) await run([{ op: 'image', expression: `window.__t18Captures[${JSON.stringify(name)}]`, out: `${name}.png` }])
      // Normal frames can contain up to four ticks; exact ticks are checked by the separate paused scenario.
      assert(perf.captured.every(frame => frame.actualTick >= frame.requestedTick && frame.actualTick < frame.requestedTick + 4 && frame.width === 2160 && frame.height === 1350), 'Capture missed its normal-clock frame')
      assert(perf.frameMs.median <= 16.7 && perf.frameMs.p95 <= 20, 'Fight interval budget missed')
      return { ...perf.frameMs, durationMs: perf.durationMs, tick: perf.tick, hash: perf.hash }
    })
    if (mode === 'perf') for (const name of ['meadow-player', 'meadow-monolith', 'meadow-wide']) await cli('shot', name, `${name}.png`)
    await montage([...Object.keys(frames).map(name => `${name}.png`), 'meadow-player.png'], 4, 2, 'fight-sheet.png')
    await montage(['meadow-player.png', 'meadow-monolith.png', 'meadow-wide.png', 'approach.png'], 2, 2, 'cams-sheet.png')
    await cli('net')
  } else {
    await check('121 fight hashes and F8 replay', async () => { await cli('run', 'game/scenarios/m1-fight-browser.json'); return { hashes: 121, finalHash: await evaluate('__game.hash()') } })
    await check('M0 smoke', async () => { await cli('run', 'game/scenarios/m0-smoke.json'); return 'same committed fixture' })
    await check('M0 real background and visible iframe blur', async () => { await cli('run', 'game/scenarios/m0-suspension.json'); return '10 seconds background; visible iframe focus loss' })
    for (const fixture of restoreFixtures()) await check(`restore ${fixture.name}`, async () => {
      await evaluate(`__game.pause();__game.restore(${JSON.stringify(fixture.snapshot)});document.querySelector('#toast')?.remove()`)
      await paint()
      assert.equal(await evaluate('__game.hash()'), fixture.hash)
      const pose = await evaluate('[...__game.debug.view.knight.actions].map(([name,a])=>[name,a.getEffectiveWeight(),a.time])')
      await cli('shot', 'meadow-player', `restores/${fixture.name}-before.png`)
      await evaluate(`__game.restore(${JSON.stringify(fixture.snapshot)})`)
      await paint()
      assert.deepEqual(await evaluate('[...__game.debug.view.knight.actions].map(([name,a])=>[name,a.getEffectiveWeight(),a.time])'), pose)
      await cli('shot', 'meadow-player', `restores/${fixture.name}-after.png`)
      const pixels = await compare(`restores/${fixture.name}-before.png`, `restores/${fixture.name}-after.png`)
      assert(pixels.percent < 0.5, `${pixels.percent}% pixels changed`)
      await evaluate(`__game.simulate([{tick:0,command:${JSON.stringify(fixture.continuation)}}],60)`)
      assert.equal(await evaluate('__game.hash()'), fixture.continuedHash)
      return pixels
    })
    const clips = await evaluate('__game.debug.view.asset.clips.map(clip=>clip.name)')
    for (const clip of clips) await check(`sheet ${clip}`, async () => { await cli('sheet', 'player', clip, `clips/${clip}.png`); return '12 fixed ages' })
    for (const reason of ['background', 'blur']) await check(`combat ${reason}`, async () => {
      const script = JSON.parse(readFileSync('game/scenarios/m1-fight-commands.json', 'utf8'))
      await evaluate(`__game.pause();__game.scenario('m1-fight',7);__game.simulate(${JSON.stringify(script)},120)`)
      await run([{ op: 'keyDown', code: 'KeyW' }, { op: reason, seconds: 10, ms: 250 }, { op: 'keyUp', code: 'KeyW' }])
      return 'real suspension; paused state retained; movement released'
    })
    await check('combat graphics loss and Reload', async () => {
      const script = JSON.parse(readFileSync('game/scenarios/m1-fight-commands.json', 'utf8'))
      await evaluate(`__game.pause();__game.scenario('m1-fight',7);__game.simulate(${JSON.stringify(script)},166)`)
      await run([{ op: 'keyDown', code: 'KeyW' }, { op: 'keyDown', code: 'Space' },
        { op: 'pointerDown', button: 'right', x: 940, y: 300 },
        { op: 'cmd', command: { move: { x: 1, z: 0 }, aim: { x: 10, z: 1 }, buttons: 2 } }])
      const before = await evaluate('__game.resume();({snapshot:__game.snapshot(),hash:__game.hash(),tick:__game.state("tick")})')
      await evaluate('__game.debug.loseDevice()')
      await until(() => evaluate('!!document.querySelector("#graphics-stopped")'))
      const lost = await evaluate('({hash:__game.hash(),tick:__game.state("tick"),paused:__game.observe().paused})')
      assert(lost.paused)
      await delay(250)
      assert.equal(await evaluate('__game.hash()'), lost.hash)
      const stoppedImage = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(out, 'graphics-stopped.png'), Buffer.from(stoppedImage.data, 'base64'))
      await evaluate('document.querySelector("#graphics-stopped button").click()').catch(() => {})
      await until(() => evaluate('!!window.__game && !document.querySelector("#graphics-stopped")'))
      await evaluate('__game.ready.then(()=>true)')
      assert.equal(await evaluate('__game.hash()'), lost.hash)
      await evaluate('__game.step(1)')
      assert.deepEqual(await evaluate('__game.observe().command'), { move: { x: 0, z: 0 }, aim: null, buttons: 0 })
      await cli('shot', 'meadow-player', 'graphics-reloaded.png')
      return { beforeTick: before.tick, lostTick: lost.tick, hash: lost.hash, reloadedInputsReleased: true }
    })
    if (build === 'dev') await check('hot update latency', async () => {
      const fixture = 'game/.play-out/t18/hmr-probe.js'
      writeFileSync(fixture, 'export const value=1; if(import.meta.hot) import.meta.hot.accept(m=>{window.__t18HMR=m.value;window.__t18HMRTime=performance.now()})')
      await evaluate('import("/play/.play-out/t18/hmr-probe.js");true')
      await delay(200)
      const before = await evaluate('__game.hash()')
      const start = await evaluate('performance.now()')
      writeFileSync(fixture, 'export const value=2; if(import.meta.hot) import.meta.hot.accept(m=>{window.__t18HMR=m.value;window.__t18HMRTime=performance.now()})')
      await until(() => evaluate('window.__t18HMR===2'))
      assert.equal(await evaluate('__game.hash()'), before)
      return { ms: await evaluate(`window.__t18HMRTime-${start}`), fixture: 'owned temporary module' }
    })
  }
  await check('console warnings/errors', async () => {
    await cli('console', '250')
    writeFileSync(join(out, 'console-live.json'), JSON.stringify(diagnostics, null, 2))
    const entries = JSON.parse(readFileSync(join(out, 'console.json'), 'utf8'))
    assert.deepEqual(entries, [])
    assert.deepEqual(diagnostics, [])
    return 'zero'
  })
} finally {
  writeFileSync(join(out, 'console-live.json'), JSON.stringify(diagnostics, null, 2))
  socket?.close()
  await cli('stop')
}
if (checks.some(check => check.result === 'FAIL')) process.exitCode = 1
