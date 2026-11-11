// T1.6 acceptance driver; uses the existing isolated Brave/play harness.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const backend = process.argv[2] ?? 'webgpu'
assert(['webgpu', 'webgl'].includes(backend))
const out = join(root, 'game/.play-out/t16', backend)
mkdirSync(out, { recursive: true })
const env = { ...process.env, PLAY_CDP_PORT: '9577' }
const log = []
function play(...args) {
  const result = execFileSync(process.execPath, ['game/tools/play.mjs', ...args, '--out-dir', out], { cwd: root, env, encoding: 'utf8' })
  log.push(result)
  writeFileSync(join(out, 'play.log'), log.join(''))
  return result
}
play('boot', `http://localhost:5197/play/?seed=7&paused=1${backend === 'webgl' ? '&backend=webgl' : ''}`)
const session = JSON.parse(readFileSync(join(root, 'game/.play-out/session.json'), 'utf8'))
const targets = await (await fetch('http://127.0.0.1:9577/json/list')).json()
const target = targets.find(target => target.id === session.targetId)
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
const pending = new Map()
const errors = []
let sequence = 0
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  else if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'warn', 'error'].includes(message.params.type)) errors.push(message.params)
  else if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) errors.push(message.params.entry)
}
socket.onclose = () => {
  for (const request of pending.values()) request.reject(new Error('Acceptance CDP socket closed'))
  pending.clear()
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result.value
}
const paint = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
const fixture = readFileSync(new URL('./combat.snapshot.json', import.meta.url), 'utf8')
const idle = { move: { x: 0, z: 0 }, aim: null, buttons: 0 }
const report = { backend, acceptance: {}, restores: [], motion: [], root: {}, perf: {} }
async function load(snapshot = fixture) {
  await evaluate(`__game.pause();__game.restore(${JSON.stringify(snapshot)})`)
  await paint()
}
async function simulate(ticks, command) {
  await evaluate(`__game.simulate([{tick:__game.state('tick'),command:${JSON.stringify(command)}}],${ticks})`)
  await paint()
}
const state = () => evaluate(`({world:__game.state(),pose:[...__game.debug.view.knight.actions].map(([name,a])=>[name,a.getEffectiveWeight(),a.time]),
  position:__game.debug.view.knight.object.position.toArray(),rotation:__game.debug.view.knight.object.rotation.y,
  aim:__game.debug.view.aim.object.rotation.y})`)
async function shot(name) { play('shot', 'meadow-player', `${name}.png`) }
async function compareFiles(a, b) {
  const urls = [a, b].map(file => `data:image/png;base64,${readFileSync(join(out, `${file}.png`)).toString('base64')}`)
  // Meadow PNGs exceed CDP's per-message limit; transfer bounded chunks.
  for (let i = 0; i < 2; i++) {
    await evaluate(`window.__image${i}=''`)
    for (let offset = 0; offset < urls[i].length; offset += 512 * 1024) {
      await evaluate(`window.__image${i}+=${JSON.stringify(urls[i].slice(offset, offset + 512 * 1024))};true`)
    }
  }
  return evaluate(`(async()=>{
    const images=await Promise.all([__image0,__image1].map(async url=>createImageBitmap(await(await fetch(url)).blob())));
    const canvas=new OffscreenCanvas(images[0].width,images[0].height),ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=images.map(image=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data});
    let changed=0;for(let i=0;i<pixels[0].length;i+=4)if([0,1,2,3].some(c=>pixels[0][i+c]!==pixels[1][i+c]))changed++;
    images.forEach(image=>image.close());return {changed,pixels:canvas.width*canvas.height,percent:changed/(canvas.width*canvas.height)*100};
  })()`)
}
async function restorePair(name) {
  const before = await state()
  const snapshot = await evaluate('__game.snapshot()')
  await shot(`${name}-before`)
  await load(snapshot)
  await shot(`${name}-restored`)
  assert.deepEqual(await state(), before, `${name}: restored rig/state differ`)
  const pixels = await compareFiles(`${name}-before`, `${name}-restored`)
  assert(pixels.percent < 0.5, `${name}: ${pixels.percent}% changed pixels`)
  report.restores.push({ name, tick: before.world.tick, ...pixels })
}

try {
  await send('Runtime.enable')
  await send('Log.enable')
  report.browser = await send('Browser.getVersion')
  assert.equal(await evaluate('__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
  const measurements = await evaluate(`(()=>{
    const v=__game.debug.view.knight;
    return {scale:v.model.scale.x,walk:v.walk,run:v.run,clips:__game.debug.view.asset.clips.map(c=>{
      const track=c.tracks.find(t=>t.name==='root.position');
      return {name:c.name,duration:c.duration,rootXZ:track?Array.from({length:track.times.length},(_,i)=>[track.times[i],track.values[i*3],track.values[i*3+2]]):null};
    })};
  })()`)
  writeFileSync(join(out, 'measurements.json'), JSON.stringify(measurements, null, 2))
  const clips = measurements.clips.map(clip => clip.name)
  for (const clip of clips) {
    play('sheet', 'player', clip, `${clip}.png`)
    process.stdout.write(`${backend}: ${clip} sheet\n`)
  }
  report.acceptance['1'] = `${clips.length} sheets; phase contacts and terminal death included`

  const far = JSON.parse(fixture)
  far.world.entities[1].pos = { x: 20, z: 20 }
  const farSnapshot = JSON.stringify(far)
  await load(farSnapshot)
  await simulate(12, { move: { x: 1, z: 0 }, aim: { x: 0.5, z: 100 }, buttons: 0 })
  await restorePair('moving')
  await simulate(2, { move: { x: 1, z: 0 }, aim: { x: 0.5, z: 100 }, buttons: 1 })
  await restorePair('action')
  await load()
  await simulate(7, { ...idle, aim: { x: 100, z: 0 }, buttons: 1 })
  assert.equal((await state()).world.entities[0].impactPauseTicks, 2)
  await restorePair('hit-stop')
  report.acceptance['2'] = 'Moving, action and hit-stop captures compare before restore and immediately after'

  const continuation = await evaluate('__game.snapshot()')
  const outputs = []
  for (const cadence of [1, 4, 60]) {
    await load(continuation)
    for (let i = 0; i < 60; i += cadence) await simulate(cadence, { ...idle, move: { x: 0, z: 1 } })
    outputs.push(await state())
  }
  assert.deepEqual(outputs[0], outputs[1])
  assert.deepEqual(outputs[0], outputs[2])
  report.acceptance['3'] = 'Identical simulation and rig after 60 ticks rendered in chunks of 1, 4 and 60'

  const root = await evaluate(`(()=>{
    const v=__game.debug.view.knight,root=v.model.getObjectByName('root');
    const samples=Array.from({length:13},(_,i)=>{v.poseClip('dodge',i/30);return root.position.toArray()});
    const asset=__game.debug.view.asset.clips.find(c=>c.name==='dodge').tracks.find(t=>t.name==='root.position');
    return {samples,sourceEnd:Array.from(asset.values.slice(-3))};
  })()`)
  assert(root.samples.every(([x, , z]) => x === 0 && z === 0))
  assert.equal(root.sourceEnd[2], 0.25)
  report.root = root
  await load(farSnapshot)
  await simulate(1, { ...idle, move: { x: 1, z: 0 }, buttons: 4 })
  await shot('dodge-start')
  await simulate(9, idle)
  await shot('dodge-active-end')
  assert(Math.abs((await state()).world.entities[0].pos.x - 3) < 1e-9)
  report.acceptance['4'] = 'All 12 sheets/previews; dodge root x/z zero at 13 samples, source asset intact, simulation travel 3 m'

  for (const degrees of [90, 180]) {
    await load(farSnapshot)
    const aim = degrees === 90 ? { x: 0.5, z: 100 } : { x: -100, z: 0 }
    await simulate(12, { ...idle, move: { x: 1, z: 0 }, aim })
    const moving = await state()
    assert.equal(moving.world.entities[0].facing, 0)
    assert(Math.abs(moving.world.entities[0].aim - degrees * Math.PI / 180) < 0.001)
    await shot(`aim-${degrees}-moving`)
    await simulate(2, { move: { x: 1, z: 0 }, aim, buttons: 1 })
    const rooted = await state()
    assert.deepEqual(rooted.world.entities[0].pos, moving.world.entities[0].pos)
    assert(rooted.world.entities[0].facing > 0)
    await restorePair(`aim-${degrees}-turn`)
    for (const ticks of [4, 6, 4, 6]) {
      await simulate(ticks, { move: { x: 1, z: 0 }, aim, buttons: 0 })
      const sample = await state()
      report.motion.push({ degrees, tick: sample.world.tick, actor: sample.world.entities[0], pose: sample.pose })
      await shot(`aim-${degrees}-tick-${sample.world.tick}`)
    }
    const resumed = (await state()).world.entities[0]
    assert.equal(resumed.action, null)
    assert(resumed.gait.speed > 0)
    assert(resumed.gait.phase > moving.world.entities[0].gait.phase)
  }
  report.acceptance['5'] = '90°/180° aim while moving; rooted attack, body turn, resumed gait and identical mid-turn restores'

  // Incoming hit and death use the same Span Cut content with a committed target strike.
  for (const lethal of [false, true]) {
    const incoming = JSON.parse(fixture)
    incoming.world.tick = 5
    const [player, target] = incoming.world.entities
    player.health = lethal ? 24 : 120
    target.facing = Math.PI
    target.action = { id: 'span-cut', kind: 'melee', startTick: 0, ageTicks: 5, direction: Math.PI,
      hitTargetIds: [], projectileSpawned: false }
    await load(JSON.stringify(incoming))
    await simulate(1, idle)
    await shot(lethal ? 'death-start' : 'incoming-hit')
    if (lethal) {
      await simulate(48, idle)
      await shot('death-terminal')
      const terminal = (await state()).pose
      await simulate(60, idle)
      assert.deepEqual((await state()).pose, terminal)
      await restorePair('death-terminal')
    }
  }

  await load(farSnapshot)
  await evaluate('__game.resume()')
  await new Promise(resolve => setTimeout(resolve, 8000))
  play('perf', '8')
  report.perf = JSON.parse(readFileSync(join(out, 'perf.json'), 'utf8'))
  assert(report.perf.frameMs.median <= 10 + 1e-8, 'Frame median exceeds 10.0 ms')
  await evaluate('__game.pause()')
  play('console', '0')
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'console.json'), 'utf8')), [])

  await send('Page.navigate', { url: `http://localhost:5197/play/anim.html?clip=block&age=0${backend === 'webgl' ? '&backend=webgl' : ''}` })
  for (let i = 0; i < 200; i++) {
    if (await evaluate('!!window.__anim?.ready').catch(() => false)) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert(await evaluate('!!window.__anim?.ready'))
  for (const clip of clips) {
    const pose = await evaluate(`__anim.setState(${JSON.stringify(clip)},3);__anim.step();__anim.state`)
    assert.equal(pose.clip, clip)
    assert.equal(pose.age, 4)
    assert(pose.pose.clips[clip]?.[0] > 0, `${clip} missing from preview pose`)
    await paint()
    assert(await evaluate(`__anim.view.actions.get(${JSON.stringify(clip)}).getEffectiveWeight()>0`), `${clip} missing from rendered preview`)
  }
  assert.equal(await evaluate('document.querySelectorAll("#state option").length'), 12)
  report.preview = 'All 12 states selected and stepped through the pure pose API'
  assert.deepEqual(errors, [])
  report.console = errors
  writeFileSync(join(out, 'acceptance.json'), JSON.stringify(report, null, 2))
  process.stdout.write(`${JSON.stringify({ backend, result: 'PASS', restores: report.restores, perf: report.perf.frameMs })}\n`)
} finally {
  writeFileSync(join(out, 'console-live.json'), JSON.stringify(errors, null, 2))
  socket.close()
}
