import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { build as bundle } from 'esbuild'
import sharp from 'sharp'

const { values: { only, ...urls } } = parseArgs({ options: {
  'dev-url': { type: 'string' }, 'static-url': { type: 'string' }, only: { type: 'string' }
} })
assert(only === undefined || ['dev', 'static', 'warm'].includes(only), '--only must be dev, static or warm')
const builds = Object.entries(urls).map(([label, href]) => [label.replace('-url', ''), new URL(href)])
assert.equal(builds.length, 2, 'Usage: m2-evaluate.mjs --dev-url URL --static-url URL')
for (const [, url] of builds) assert.equal(url.pathname, '/play/', 'Include /play/ in each URL')
const env = { ...process.env, PLAY_CDP_PORT: process.env.PLAY_CDP_PORT ?? '9584', PLAY_HEADLESS: process.env.PLAY_HEADLESS ?? '1' }
const endpoint = `http://127.0.0.1:${env.PLAY_CDP_PORT}`
const out = resolve('game/.play-out/m2')
const report = []
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
const paint = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))'
const json = JSON.stringify
const m1Commands = read('game/scenarios/m1-fight-commands.json')
const m1Expected = read('game/scenarios/m1-fight.json')
const nodeBalance = read(join(out, 'balance.json'))
const nodeBench = read(join(out, 'bench.json'))
const evalStep = (expression, ...expected) => ({ op: 'eval', expression, ...(expected.length && { expect: expected[0] }) })

// Share fixture preparation and standalone measurements across environments.
const code = (await bundle({ stdin: { resolveDir: process.cwd(), contents: `
  import { buildScenario } from './game/src/sim/scenarios';
  import { hashWorld, IDLE_COMMAND, serialize, step } from './game/src/sim/core';
  import { balanceWorld } from './game/tools/m2-balance';
  import { balanceFixtures, balanceCommand } from './game/tools/m2-fixtures';
  export { runBench, summarize } from './game/tools/m2-bench';
  export { runBalance } from './game/tools/m2-balance';
  export { restoreFixtures } from './game/tools/t18-fixtures';
  export function fight(seed) {
    const fixture = balanceFixtures[0];
    return { snapshot: serialize(balanceWorld(fixture, seed)), command: world => balanceCommand(world, fixture) };
  }
  export function balanceScript(build, seed, ticks) {
    const fixture = balanceFixtures.find(fixture => fixture.id === build);
    const world = balanceWorld(fixture, seed);
    const { character, health, maxHealth, skills } = world.entities.find(actor => actor.id === world.playerId);
    const setup = { player: { character: structuredClone(character), health, maxHealth, skills: { ...skills } },
      lootRng: [...world.rng.loot], nextItemId: world.nextItemId };
    const script = [];
    for (let tick = 0; tick < ticks; tick++) {
      const command = balanceCommand(world, fixture);
      script.push({ tick, command });
      step(world, command);
    }
    return { setup, script };
  }
  export function checkpoints(scenario, seed, ticks, script = [{ tick: 0, command: IDLE_COMMAND }]) {
    const world = buildScenario(scenario, seed), hashes = [[0, hashWorld(world)]];
    let index = 0;
    for (let tick = 0; tick < ticks; tick++) {
      while (script[index + 1]?.tick <= tick) index++;
      step(world, script[index].command);
      if (world.tick % 60 === 0 || world.tick === ticks) hashes.push([world.tick, hashWorld(world)]);
    }
    return hashes;
  }
` }, bundle: true, format: 'esm', write: false, external: ['node:*'] })).outputFiles[0].text
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const attachTools = evalStep(`import(${json(moduleUrl)}).then(module => { window.__m2Tools = module; return true })`, true)
const bench = await import(moduleUrl)
const nodeM1 = bench.checkpoints('m1-fight', 7, m1Expected.ticks, m1Commands)
assert.deepEqual(nodeM1, m1Expected.checkpoints)
write(join(out, 'm1-node-checkpoints.json'), nodeM1)
const balanceScripts = () => nodeBalance.runs.map(({ build, seed, ticks }) => bench.balanceScript(build, seed, ticks))

const dummyTicks = nodeBench.warmupTicks + nodeBench.dummies.samples

function child(file, args, directory, overrides = {}) {
  mkdirSync(directory, { recursive: true })
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [file, ...args], { env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    proc.stdout.on('data', bytes => { stdout += bytes })
    proc.stderr.on('data', bytes => { stderr += bytes })
    proc.on('error', reject)
    proc.on('close', status => {
      appendFileSync(join(directory, basename(file, '.mjs') + '.log'), stdout + stderr)
      resolve({ status, stdout, stderr })
    })
  })
}

function driver(directory) {
  mkdirSync(directory, { recursive: true })
  let sequence = 0
  const raw = async (...args) => {
    const result = await child('game/tools/play.mjs', [...args, '--out-dir', directory], directory)
    const rows = result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    return { ...result, rows }
  }
  const call = async (...args) => {
    const { status, stderr, stdout, rows } = await raw(...args)
    assert.equal(status, 0, stderr || stdout.slice(-1400))
    return rows
  }
  const run = steps => {
    const file = join(directory, `steps-${++sequence}.json`)
    write(file, { steps })
    return call('run', file)
  }
  return { call, raw, run, directory, evaluate: async expression => (await run([evalStep(expression)])).find(row => row.command === 'eval').value }
}

async function check(context, name, evaluate) {
  try { report.push({ ...context, name, result: 'PASS', evidence: await evaluate() }) }
  catch (error) { report.push({ ...context, name, result: 'FAIL', reason: error.message }) }
  console.log(JSON.stringify(report.at(-1)))
  write(join(out, only ? `evaluation-${only}.json` : 'evaluation.json'), report)
}

async function runM1Fixture(game, file) {
  const { status, stderr, rows } = await game.raw('run', file)
  if (status === 0) return { rows, literalExit: 0, advisories: [] }
  const { steps } = read(file)
  const consoleStep = steps.findIndex(step => step.op === 'console')
  assert(consoleStep >= 0 && stderr.includes(`Step ${consoleStep + 1} (console): Expected an empty game console`), stderr)
  const advisories = rows.findLast(row => row.command === 'console')?.entries ?? []
  assert(advisories.length > 0 && advisories.every(entry => entry.type === 'info' && entry.text.includes('Download the React DevTools')), stderr)
  if (consoleStep + 1 < steps.length) await game.run(steps.slice(consoleStep + 1))
  return { rows, literalExit: status, advisories }
}

async function pixelDiff(first, second) {
  const [a, b] = await Promise.all([first, second].map(path => sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })))
  assert.deepEqual(a.info, b.info)
  let changed = 0
  for (let byte = 0; byte < a.data.length; byte += 4) {
    if ([0, 1, 2, 3].some(channel => a.data[byte + channel] !== b.data[byte + channel])) changed++
  }
  return { changed, pixels: a.data.length / 4, percent: 400 * changed / a.data.length }
}

async function withPage(run) {
  const { targetId } = read('game/.play-out/session.json')
  const targets = await (await fetch(endpoint + '/json/list')).json()
  const socket = new WebSocket(targets.find(target => target.id === targetId).webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let serial = 0
  const send = (method, params = {}, timeout = 10000) => new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), timeout)
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data)
      if (message.id !== id) return
      clearTimeout(timer)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
    socket.send(json({ id, method, params }))
  })
  try { return await run(send) }
  finally { socket.close() }
}

const resize = (send, width, height, deviceScaleFactor) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false })

async function servedBalance(seed, { setup, script }) {
  const game = window.__game
  game.pause()
  game.scenario('m2-balance', seed)
  const snapshot = JSON.parse(game.snapshot()), world = snapshot.world
  Object.assign(world.entities.find(actor => actor.id === world.playerId), setup.player)
  world.rng.loot = setup.lootRng
  world.nextItemId = setup.nextItemId
  game.restore(JSON.stringify(snapshot))

  const checkpoints = [[0, game.hash()]]
  for (let start = 0; start < script.length; start += 60) {
    const batch = script.slice(start, start + 60)
    checkpoints.push([start + batch.length, game.simulate(batch, batch.length)])
  }
  const text = await game.exportReplay()
  return { checkpoints, text, verified: await game.loadReplay(text), replayHash: game.hash() }
}

function servedDummies(seed, ticks) {
  const game = window.__game
  game.pause()
  const previous = game.snapshot()
  try {
    game.scenario('dummies-1000', seed)
    const actors = game.state('entities').filter(actor => actor.kind === 'dummy').length
    const checkpoints = [[0, game.hash()]]
    for (let start = 0; start < ticks; start += 60) {
      const batch = Math.min(60, ticks - start)
      checkpoints.push([start + batch, game.simulate([], batch)])
    }
    return { actors, checkpoints }
  } finally { game.restore(previous) }
}

async function captureUI(game, name) {
  await withPage(async send => {
    for (const [width, height] of [[1440, 900], [1024, 768]]) {
      await resize(send, width, height, 1)
      const frame = await send('Runtime.evaluate', { expression: paint, awaitPromise: true })
      assert(!frame.exceptionDetails)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(game.directory, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'))
    }
  })
}

async function qualityScreens(game) {
  const act = command => game.evaluate(`(async () => {
    const button = label => [...document.querySelectorAll('button')].find(button => label.test(button.textContent.trim()));
    const select = element => { if (!element) throw new Error('Missing quality capture control'); element.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    const paint = () => ${paint};
    ${command}
  })()`)
  await captureUI(game, 'inventory-comparison')
  await act(`select(button(/^Passives$/)); await paint();
    for (const id of ['1,0', '0,1', '1,1']) if (!__game.character.allocate(id).accepted) throw new Error('Rhombus allocation rejected');
    if (!__game.character.activateShape('rhombus-0').accepted) throw new Error('Rhombus activation rejected');
    await paint(); select(document.querySelector('polygon.active')); await paint();`)
  await captureUI(game, 'graph-completed')
  await act(`select(document.querySelector('g[aria-label^="1,0 "]')); await paint(); select(button(/^Refund$/)); await paint();`)
  await captureUI(game, 'graph-refund')
  await act(`select(button(/^Drawings$/)); await paint(); select(button(/^Fold Dart/)); await paint();
    select(button(/^Long Pleat$/)); await paint();`)
  await captureUI(game, 'fold-legal')
  await act(`select(button(/^Confirm$/)); await paint(); select(button(/^Kiln Pleat$/)); await paint();`)
  await captureUI(game, 'fold-illegal')
  return { screens: 10, viewports: ['1440×900', '1024×768'] }
}

async function saveProbe() {
  const game = window.__game
  const key = 'folio.arpg.save'
  const player = () => game.state('entities').find(actor => actor.id === game.state('playerId'))
  const generation = () => JSON.parse(localStorage.getItem(key) ?? '{"generation":0}').generation
  const find = text => [...document.querySelectorAll('button')].find(button => text.test(button.textContent))
  const until = async (ready, label) => {
    const end = performance.now() + 5000
    while (!ready()) {
      if (performance.now() >= end) throw new Error(`Timed out waiting for ${label}`)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  await until(() => find(/^Reset$/), 'Reset control')
  game.pause()
  if (!game.character.allocate('1,0').accepted) throw new Error('Initial allocation rejected')
  find(/^Reset$/).click()
  await until(() => find(/^Confirm$/), 'Reset confirmation')
  const resetGeneration = generation()
  find(/^Confirm$/).click()
  const immediatePoints = player().character.points
  await until(() => generation() > resetGeneration && player().character.points === 4, 'Reset commit')
  const fresh = player().character
  if (!(await game.save.flush()).ok || JSON.stringify(JSON.parse(localStorage.getItem(key)).character) !== JSON.stringify(JSON.parse(game.save.export()).character)) {
    throw new Error('Reset did not leave a valid save')
  }
  document.querySelector('dialog .close, [role=dialog] .close')?.click()

  const transitions = []
  for (const [edit, phase] of [[() => game.character.beginEncounter(), 'active'], [() => game.step(900), 'defeat'],
    [() => game.character.returnToShelter(), 'rest']]) {
    const before = generation()
    edit()
    await until(() => generation() > before && game.state('encounter.phase') === phase, phase + ' save')
    transitions.push({ phase, before, after: generation() })
  }

  const loot = []
  for (const wholeTrio of [false, true]) {
    if (game.state('encounter.phase') !== 'rest') game.scenario('m2-clearing', 1)
    await until(() => find(/^Start/), 'Start control')
    find(/^Start/).click()
    const snapshot = JSON.parse(game.snapshot())
    const world = snapshot.world, actor = world.entities.find(actor => actor.id === world.playerId)
    actor.pos = { x: 0, z: 0 }; actor.action = null; actor.previousButtons = 0
    const enemies = world.entities.filter(actor => actor.ai && actor.health > 0)
    if (!wholeTrio) world.entities = world.entities.filter(actor => !actor.ai || actor.id === enemies[0].id)
    for (const [index, enemy] of enemies.entries()) {
      enemy.health = 1
      enemy.pos = [{ x: 1, z: 0 }, { x: 1.1, z: .7 }, { x: 1.1, z: -.7 }][index]
      enemy.action = null
    }
    world.content.m2.lootTables.forEach(table => { table.dropChance = 1 })
    game.restore(JSON.stringify(snapshot))
    game.cmd({ move: { x: 0, z: 0 }, aim: { x: 10, z: 0 }, buttons: 1 })
    game.step(10)
    const drops = game.state('groundDrops').length, immediateLabel = find(/^Start/)?.textContent ?? null
    if (game.state('encounter.phase') !== 'rest' || drops !== (wholeTrio ? 3 : 1)) throw new Error('Unexpected final-kill loot')
    await until(() => find(/^Start/)?.textContent.includes(String(drops)), 'next HUD frame')
    const paintedLabel = find(/^Start/).textContent
    const inventory = player().character.inventory.length
    const stage = document.querySelector('canvas')
    stage.focus()
    for (const type of ['keydown', 'keyup']) stage.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF', key: 'f', bubbles: true }))
    game.step(1)
    if (player().character.inventory.length !== inventory + 1) throw new Error('Rest drop could not be picked up')
    find(/^Start/).click()
    if (game.state('groundDrops').length !== 0) throw new Error('Start did not clear the remaining drops')
    loot.push({ wholeTrio, drops, immediateLabel, paintedLabel, collected: true, remainingAfterStart: 0 })
  }
  return { reset: { immediatePoints, committedPoints: fresh.points, rank: fresh.rank, allocations: fresh.graph.allocations },
    transitions, loot }
}

async function replayIsolation() {
  const game = window.__game
  game.pause()
  const save = await game.save.flush()
  if (!save.ok) throw new Error('Expected writer before replay')
  const key = 'folio.arpg.save', prior = localStorage.getItem(key)
  const replay = await game.exportReplay()
  if (!(await game.loadReplay(replay)).ok) throw new Error('Replay verification failed')
  dispatchEvent(new PageTransitionEvent('pagehide'))
  const flush = await game.save.flush()
  await new Promise(resolve => setTimeout(resolve, 150))
  if (flush.ok || localStorage.getItem(key) !== prior) throw new Error('Replay modified the player save')
  return { generation: save.status.generation, flush: flush.reason, bytesUnchanged: true }
}

async function inventoryProbe() {
  const game = window.__game
  const save = JSON.parse(game.save.export())
  const character = save.character
  const weapon = character.items.find(item => item.id === character.equipment.weapon)
  for (let index = 0; index < 60; index++) {
    const item = { ...structuredClone(weapon), id: save.nextItemId++ }
    character.items.push(item)
    character[index < 30 ? 'inventory' : 'stash'].push(item.id)
  }
  if (!(await game.save.import(JSON.stringify(save))).ok) throw new Error('Full inventory import rejected')
  const stage = document.querySelector('canvas')
  stage.focus()
  stage.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }))
  const count = () => (document.body.innerText.match(/30\s*\/\s*30/g) ?? []).length
  const immediate = count()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const painted = count()
  if (painted !== 2) throw new Error('Inventory and stash should both show 30 / 30')
  return { immediate, painted }
}

async function graphicsInput(driver) {
  const input = { move: { x: 1, z: 0 }, aim: { x: 10, z: 1 }, buttons: 2 }
  const steps = [evalStep(`__game.pause();__game.scenario('m1-fight',7);__game.simulate(${json(m1Commands)},166)`),
    { op: 'keyDown', code: 'KeyW' }, { op: 'keyDown', code: 'Space' },
    { op: 'pointerDown', button: 'right', x: 940, y: 300 }, { op: 'cmd', command: input },
    evalStep(`(async () => { __game.debug.loseDevice();
      while (!document.querySelector('#graphics-stopped button')) await new Promise(resolve => setTimeout(resolve, 16));
      return { tick: __game.state('tick'), hash: __game.hash(), paused: __game.observe().paused };
    })()`),
    { op: 'shot', bookmark: 'meadow-player', out: 'graphics-stopped.png' }, { op: 'recover' }]
  const rows = await driver.run(steps)
  const lost = rows.filter(row => row.command === 'eval').at(-1).value
  const recovered = rows.find(row => row.command === 'recover').state
  assert.equal(lost.paused, true)
  assert.equal(recovered.hash, lost.hash)
  assert.equal(recovered.tick, lost.tick)
  await driver.run([evalStep('__game.step(1);__game.observe().command', { move: { x: 0, z: 0 }, aim: null, buttons: 0 }),
    { op: 'shot', bookmark: 'meadow-player', out: 'graphics-reloaded.png' }])
  return { ...lost, released: true }
}

async function hotUpdate(driver, path) {
  const file = join(path, 'probe.js')
  const source = value => `export const value=${value}; import.meta.hot.accept(next => { if (next) { window.__m2Hmr = next.value; window.__m2HmrTime = performance.now() } })`
  writeFileSync(file, source(1))
  await driver.evaluate(`import(${json('/play/' + basename(path) + '/probe.js')}).then(module => module.value)`)
  await delay(150)
  const before = await driver.evaluate('({ hash: __game.hash(), start: performance.now() })')
  writeFileSync(file, source(2))
  const result = await driver.evaluate(`(async () => {
    while (window.__m2Hmr !== 2) await new Promise(resolve => setTimeout(resolve, 20));
    return { ms: window.__m2HmrTime - ${before.start}, hash: __game.hash() };
  })()`)
  assert.equal(result.hash, before.hash)
  return { ms: result.ms }
}

async function warmFight(seed) {
  const game = window.__game, tools = window.__m2Tools
  const { snapshot, command } = tools.fight(seed)
  const view = game.debug.view, advance = view.advance
  const play = (ticks, duration) => new Promise(resolve => {
    let lastTick = -1, firstFrame, previousFrame, finalHash
    const intervals = []
    view.advance = function (world) {
      advance.call(this, world)
      if (world.tick === lastTick) return
      lastTick = world.tick
      if (world.tick < ticks) game.cmd(command(world))
      else if (world.tick === ticks) {
        finalHash = game.hash()
        game.pause()
      }
    }
    function sample(now) {
      firstFrame ??= now
      if (previousFrame !== undefined) intervals.push(now - previousFrame)
      previousFrame = now
      if (finalHash && now - firstFrame >= duration) resolve({ durationMs: now - firstFrame, intervals, hash: finalHash })
      else requestAnimationFrame(sample)
    }
    game.restore(snapshot)
    game.camera.follow()
    game.resume()
    requestAnimationFrame(sample)
  })
  try {
    await play(600, 0)
    const result = await play(7200, 120000)
    return { ...result, frameMs: tools.summarize(result.intervals), seed, fixture: 'weight-melee', build: game.build,
      backend: game.backend, warmupTicks: 600, ticks: 7200,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio } }
  } finally {
    game.pause()
    view.advance = advance
  }
}

const scripts = only === 'warm' ? [] : balanceScripts()
const nodeDummies = only === 'warm' ? [] : bench.checkpoints('dummies-1000', nodeBench.seed, dummyTicks)
for (const [build, url] of builds.filter(([label]) => !only || label === only)) {
  const group = join(out, build + '-m1')
  for (const [name, file] of [['DOM combat input', 'game/src/debug/combat-input-check.mjs'], ['Graphics recovery modes', 'game/tools/t110-check.mjs']]) {
    await check({ build }, name, async () => {
      const result = await child(file, [], group, { PLAY_ORIGIN: url.origin })
      const cases = result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.check)
      write(join(group, basename(file, '.mjs') + '.json'), cases)
      assert.equal(result.status, 0, result.stderr || JSON.stringify(cases.filter(row => row.result === 'FAIL')))
      return Object.fromEntries(['webgpu', 'webgl'].map(backend => [backend, cases.filter(row => row.backend === backend).length]))
    })
  }
  for (const backend of ['webgpu', 'webgl']) {
    const context = { build, backend }
    const directory = join(out, `${build}-${backend}`, 'evaluation')
    const game = driver(directory)
    const destination = new URL(url)
    destination.searchParams.set('backend', backend)
    const version = await (await fetch(new URL('build.json', url))).json()
    const hmrPath = build === 'dev' ? mkdtempSync('game/.m2-hmr-') : undefined
    try {
      await check(context, 'Cold browser ready, backend, build stamp', async () => {
        const [boot] = await game.call('boot', destination.href)
        const info = await game.evaluate('({ build:__game.build, backend:__game.backend, userAgent:navigator.userAgent })')
        assert.equal(info.backend, backend === 'webgl' ? 'webgl2' : 'webgpu')
        assert.equal(info.build, version.build)
        const browser = await (await fetch(endpoint + '/json/version')).json()
        return { ...info, browser: browser.Browser, readyMs: boot.readyMs, under2s: boot.readyMs < 2000 }
      })
      await check(context, 'Transition saves and deferred Reset/loot observations', async () => {
        const evidence = await game.evaluate(`(${saveProbe.toString()})()`)
        assert.deepEqual(evidence.reset.allocations, [])
        return evidence
      })
      await check(context, 'Imported inventory and stash counts after HUD paint', async () => {
        await game.call('boot', destination.href)
        return game.evaluate(`(${inventoryProbe.toString()})()`)
      })
      await check(context, 'Supplemental DOM-inclusive quality screens', () => qualityScreens(game))
      await check(context, 'Debug replay cannot write the character', async () => {
        await game.call('boot', destination.href)
        return game.evaluate(`(${replayIsolation.toString()})()`)
      })
      destination.searchParams.set('scenario', 'm1-fight')
      destination.searchParams.set('seed', '7')
      await game.call('boot', destination.href)
      await check(context, '7,200 M1 ticks, 121 checkpoints, F8 replay', async () => {
        const { rows, literalExit, advisories } = await runM1Fixture(game, 'game/scenarios/m1-fight-browser.json')
        assert.deepEqual(rows.filter(row => row.command === 'expectHash').map(row => row.hash), nodeM1.map(([, hash]) => hash))
        const replay = rows.find(row => row.command === 'replay')
        assert.equal(replay?.hash, m1Expected.finalHash)
        return { checkpoints: nodeM1.length, ...replay, literalExit, advisories }
      })
      for (const [name, path] of [['M0 smoke and bookmarks', 'm0-smoke'], ['M1 carry-forward focus and background', 'm0-suspension']]) {
        await check(context, name, async () => {
          const { literalExit, advisories } = await runM1Fixture(game, `game/scenarios/${path}.json`)
          return { file: path + '.json', literalExit, advisories }
        })
      }
      for (const fixture of bench.restoreFixtures()) await check(context, `Restore ${fixture.name}`, async () => {
        const restore = `__game.pause();__game.restore(${json(fixture.snapshot)});document.querySelector('#toast')?.remove();${paint}`
        const pose = '[...__game.debug.view.knight.actions].map(([name,action])=>[name,action.getEffectiveWeight(),action.time])'
        const before = `restores/${fixture.name}-before.png`, after = `restores/${fixture.name}-after.png`
        const rows = await game.run([evalStep(restore), evalStep('__game.hash()', fixture.hash), evalStep(pose),
          { op: 'shot', bookmark: 'meadow-player', out: before }, evalStep(restore), evalStep(pose),
          { op: 'shot', bookmark: 'meadow-player', out: after },
          evalStep(`__game.simulate([{ tick:0, command:${json(fixture.continuation)} }],60)`, fixture.continuedHash)])
        const poses = rows.filter(row => row.command === 'eval').map(row => row.value).filter(Array.isArray)
        assert.deepEqual(poses[0], poses[1])
        const pixels = await pixelDiff(join(directory, before), join(directory, after))
        assert(pixels.percent < .5, `${pixels.percent}% pixels changed`)
        return { ...pixels, hash: fixture.hash, continuedHash: fixture.continuedHash }
      })
      await check(context, 'Graphics loss retains M1 snapshot and releases held, pending and queued input', () => graphicsInput(game))
      if (hmrPath) await check(context, 'Hot update latency', () => hotUpdate(game, hmrPath))
      await check(context, 'Served balance parity and 20 rotated replays', async () => {
        const served = []
        for (const [index, expected] of nodeBalance.runs.entries()) {
          const { text, ...result } = await game.evaluate(`(${servedBalance.toString()})(${expected.seed},${json(scripts[index])})`)
          const replay = JSON.parse(gunzipSync(Buffer.from(text, 'base64url')).toString('utf8'))
          served.push({ build: expected.build, seed: expected.seed, ...result,
            replay: { start: replay.start.world.tick, ticks: replay.commands.length, hashes: replay.hashes } })
        }
        write(join(directory, 'served-balance.json'), served)
        for (const [index, run] of served.entries()) {
          const expected = nodeBalance.runs[index]
          const label = `${run.build} seed ${run.seed}`
          assert.deepEqual(run.checkpoints, expected.checkpoints, label)
          assert.deepEqual({ ...run.verified, start: run.replay.start, ticks: run.replay.ticks }, expected.replay, label)
          assert.deepEqual(run.replay.hashes, expected.checkpoints.filter(([tick]) => tick >= expected.replay.start), label)
          assert.equal(run.replayHash, expected.hash, label)
        }
        // Keep the standalone damage attribution and gate comparisons.
        await game.run([attachTools,
          { op: 'artifact', expression: '__m2Tools.runBalance()', out: 'balance.json' }])
        const runs = read(join(directory, 'balance.json'))
        assert.deepEqual(runs, nodeBalance.runs)
        return { runs: served.length, checkpointsPerRun: served[0].checkpoints.length, replays: served.filter(run => run.verified.ok).length }
      })
      await check(context, 'Served 1,000-dummy parity and standalone Brave benchmark', async () => {
        const served = await game.evaluate(`(${servedDummies.toString()})(${nodeBench.seed},${dummyTicks})`)
        write(join(directory, 'served-dummies.json'), served)
        assert.equal(served.actors, nodeBench.dummies.actors)
        assert.deepEqual(served.checkpoints, nodeDummies)
        assert.deepEqual(served.checkpoints.at(-1), [dummyTicks, nodeBench.dummies.hash])
        // The public API cannot refill projectiles or refresh the 200-actor stress workload between ticks.
        await game.run([attachTools, { op: 'artifact', expression: '__m2Tools.runBench()', out: 'bench.json' }])
        const { stress, dummies } = read(join(directory, 'bench.json'))
        const fields = ['hash', 'samples', 'actorPeak', 'projectilePeak', 'postTickProjectileMin', 'contacts', 'damageEvaluations']
        for (const field of fields) assert.equal(stress[field], nodeBench.stress[field], field)
        assert.equal(dummies.hash, nodeBench.dummies.hash)
        const summary = ({ intervals: _intervals, ...measurement }) => measurement
        return { servedDummies: { hash: served.checkpoints.at(-1)[1], checkpoints: served.checkpoints.length },
          standaloneStress: summary(stress), standaloneDummies: summary(dummies) }
      })
      await check(context, 'Runtime console', async () => {
        const { entries } = (await game.run([{ op: 'console', ms: 250 }])).find(row => row.command === 'console')
        const issues = entries.filter(entry => ['warning', 'warn', 'error'].includes(entry.type))
        assert.deepEqual(issues, [])
        return { warnings: 0, errors: 0, other: entries }
      })
    } finally {
      try { await game.call('stop') }
      finally { if (hmrPath) rmSync(hmrPath, { recursive: true, force: true }) }
    }
  }
}

const staticUrl = builds.find(([name]) => name === 'static')[1]
for (const backend of !only || only === 'warm' ? ['webgpu', 'webgl'] : []) {
  const directory = join(out, 'warm-' + backend)
  const game = driver(directory)
  const destination = new URL(staticUrl)
  destination.searchParams.set('backend', backend)
  try {
    await check({ build: 'static', backend }, 'Two-minute warm normal-clock fight', async () => {
      await game.call('boot', destination.href)
      await game.run([attachTools])
      const result = await withPage(async send => {
        await resize(send, 1440, 900, 1.5)
        await send('Emulation.setFocusEmulationEnabled', { enabled: true })
        const { result, exceptionDetails } = await send('Runtime.evaluate', {
          expression: `(async () => { await ${paint}; return (${warmFight.toString()})(7); })()`,
          awaitPromise: true, returnByValue: true
        }, 180000)
        assert(!exceptionDetails, exceptionDetails?.exception?.description)
        return result.value
      })
      write(join(directory, 'fight-perf.json'), result)
      await game.run([{ op: 'console', expectEmpty: true }])
      assert.deepEqual(result.viewport, { width: 1440, height: 900, pixelRatio: 1.5 })
      assert.equal(result.hash, nodeBalance.runs.find(run => run.build === 'weight-melee' && run.seed === 7).hash)
      assert(result.durationMs >= 120000, 'Fight duration below two minutes')
      return { build: result.build, viewport: result.viewport, ms: result.durationMs, hash: result.hash, ...result.frameMs,
        budgetMet: result.frameMs.median <= 16.7 && result.frameMs.p95 <= 20 }
    })
  } finally { await game.call('stop') }
}
if (report.some(row => row.result === 'FAIL')) process.exitCode = 1
