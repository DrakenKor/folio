import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Neutral fixtures exercise the public debug boundary; all tick intent uses commands.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const tool = fileURLToPath(new URL('../../tools/play.mjs', import.meta.url))
const origin = process.env.PLAY_ORIGIN ?? 'http://127.0.0.1:5196'
const env = { ...process.env, PLAY_CDP_PORT: process.env.PLAY_CDP_PORT ?? '9576', PLAY_HEADLESS: process.env.PLAY_HEADLESS ?? '1' }
const results = []
function cli(...args) {
  const input = args[0] === 'run' ? JSON.stringify({ steps: args.splice(1)[0] }) : undefined
  if (input) args.push('/dev/stdin')
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, env, input, encoding: 'utf8', timeout: 60000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}
const run = steps => cli('run', steps)
const evaluate = expression => run([{ op: 'eval', expression }]).find(row => row.command === 'eval').value
const observe = () => cli('observe')[0]
const player = state => state.actors.find(actor => actor.id === state.playerId)
const idle = { move: { x: 0, z: 0 }, aim: null, buttons: 0 }
const check = (backend, name, fn) => {
  try { fn(); results.push({ backend, check: name, result: 'PASS' }) }
  catch (error) { results.push({ backend, check: name, result: 'FAIL', reason: error.message }) }
  process.stdout.write(`${JSON.stringify(results.at(-1))}\n`)
}

try {
  for (const backend of ['webgpu', 'webgl']) {
    cli('boot', `${origin}/play/?view=basic&backend=${backend}&paused=1`)
    const snapshot = JSON.parse(evaluate('__game.snapshot()'))
    const world = snapshot.world
    world.entities = world.entities.filter(actor => actor.id === world.playerId)
    const actor = world.entities[0]
    actor.health = actor.maxHealth = 100
    actor.skills = { primary: 'fixture-melee', secondary: 'fixture-projectile' }
    const common = { cooldownTicks: 0, damage: 10, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 2, hitFlashTicks: 6 }
    world.content.skills = [
      { ...common, id: 'fixture-melee', kind: 'melee', timing: { windupTicks: 6, activeTicks: 3, recoveryTicks: 12, moveCancelTicks: 2 }, range: 2, arcRadians: Math.PI },
      { ...common, id: 'fixture-projectile', kind: 'projectile', timing: { windupTicks: 8, activeTicks: 1, recoveryTicks: 15, moveCancelTicks: 2 }, speed: 12, radius: 0.1, lifetimeTicks: 60 }
    ]
    const reset = (fixture = snapshot) => evaluate(`__game.pause(); __game.restore(${JSON.stringify(JSON.stringify(fixture))})`)
    const step = ticks => run([{ op: 'wait', ticks }])
    const command = value => cli('cmd', JSON.stringify(value))
    const press = (button, held = false) => {
      if (button === 4) run([{ op: 'keyDown', code: 'Space' }, ...held ? [] : [{ op: 'keyUp', code: 'Space' }]])
      else run([{ op: 'pointerDown', button: button === 1 ? 'left' : 'right', x: 940, y: 300 },
        ...held ? [] : [{ op: 'pointerUp', button: button === 1 ? 'left' : 'right', x: 940, y: 300 }]])
    }

    check(backend, '1: W and world aim consumed at N+1', () => {
      assert.equal(evaluate('__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
      reset()
      const expected = evaluate('({move:__game.debug.view.camera.basis().forward,aim:__game.debug.view.camera.groundPoint(940,300),buttons:0})')
      run([{ op: 'keyDown', code: 'KeyW' }, { op: 'pointerMove', x: 940, y: 300 }, { op: 'wait', ticks: 1 }, { op: 'keyUp', code: 'KeyW' }])
      const state = observe()
      assert.equal(state.tick, world.tick + 1)
      assert.equal(state.commandTick, state.tick)
      assert.deepEqual(state.command, expected)
      assert.notDeepEqual(player(state).pos, actor.pos)
      assert.notEqual(player(state).facing, actor.facing)
      reset(); command(state.command); step(1)
      assert.equal(observe().hash, state.hash)
    })
    for (const [bit, kind] of [[1, 'melee'], [2, 'projectile'], [4, 'dodge']]) {
      check(backend, `1/2: bit ${bit} brief press consumed exactly once; cmd parity`, () => {
        reset(); press(bit); step(1)
        const live = observe()
        assert.equal(live.command.buttons, bit)
        assert.equal(live.commandTick, world.tick + 1)
        step(1)
        const released = observe()
        assert.equal(released.command.buttons, 0)
        reset(); command(live.command); step(1)
        assert.equal(observe().hash, live.hash)
        command(released.command); step(1)
        assert.equal(observe().hash, released.hash)
      })
      check(backend, `1: bit ${bit} starts ${kind} at N+1`, () => {
        reset(); press(bit); step(1)
        const action = player(observe()).action
        assert(action, 'T1.3: action did not start')
        assert.equal(action.kind, kind)
        assert.equal(action.startTick, world.tick + 1)
        assert.equal(action.ageTicks, 0)
        assert.equal(action.phase, bit === 4 ? 'active' : 'windup')
      })
    }
    check(backend, '2: held Space never chains dodges', () => {
      reset(); press(4, true); step(1)
      assert.equal(player(observe()).action?.kind, 'dodge', 'T1.3: initial dodge missing')
      step(60)
      assert.equal(player(observe()).action, null)
      run([{ op: 'keyUp', code: 'Space' }]); step(1); press(4); step(1)
      assert.equal(player(observe()).action?.kind, 'dodge')
    })
    for (const [bit, duration] of [[1, 21], [2, 24]]) check(backend, `2: held attack ${bit} repeats at completion`, () => {
      reset(); press(bit, true); step(1)
      assert.equal(player(observe()).action?.ageTicks, 0, 'T1.3: initial attack missing')
      step(duration - 1)
      assert.equal(player(observe()).action.ageTicks, duration - 1)
      step(1)
      assert.equal(player(observe()).action.startTick, world.tick + 1 + duration)
    })
    check(backend, '2: dodge interrupts windup/recovery, never active; blocked edge consumed', () => {
      for (const age of [0, 6, 9]) {
        reset(); command({ ...idle, buttons: 1 }); step(1); step(age)
        assert.equal(player(observe()).action?.kind, 'melee', 'T1.3: melee missing')
        press(4, true); step(1)
        assert.equal(player(observe()).action.kind, age === 6 ? 'melee' : 'dodge')
        if (age === 6) { step(5); assert.notEqual(player(observe()).action?.kind, 'dodge') }
      }
    })
    check(backend, '3: cmd overrides live input for one tick; simulate records same stream', () => {
      reset(); run([{ op: 'keyDown', code: 'KeyW' }]); press(4)
      command(idle); step(1)
      assert.deepEqual(observe().command, idle)
      step(1)
      const state = observe()
      assert.notDeepEqual(state.command.move, idle.move)
      assert.equal(state.command.buttons, 0, 'Overridden brief input must not leak into a later tick')
      reset(); command({ ...idle, buttons: 2 })
      evaluate(`__game.simulate([{tick:0,command:${JSON.stringify(idle)}}],1)`)
      assert.equal(observe().command.buttons, 2)
    })
    for (const reason of ['blur', 'hide', 'restore']) check(backend, `3: ${reason} clears held, pending and queued input`, () => {
      reset(); run([{ op: 'keyDown', code: 'KeyW' }]); press(1, true); press(4); command({ ...idle, buttons: 2 })
      if (reason === 'restore') reset()
      else evaluate(reason === 'blur' ? 'window.dispatchEvent(new Event("blur"))' :
        'Object.defineProperty(document,"hidden",{value:true,configurable:true}); document.dispatchEvent(new Event("visibilitychange")); Reflect.deleteProperty(document,"hidden")')
      step(1)
      assert.deepEqual(observe().command, idle)
    })
    check(backend, '3: F8 replay verifies the live and cmd session', () => {
      reset(); press(1); step(1); step(25); press(2); step(1); step(25); press(4); step(1); step(35)
      command({ move: { x: 1, z: 0 }, aim: { x: 4, z: 1 }, buttons: 1 }); step(1); step(30)
      run([{ op: 'replay' }])
    })
    check(backend, '3: death disables gameplay; restart and F8 remain usable', () => {
      reset(); const dead = structuredClone(snapshot)
      dead.world.entities[0].health = 0
      dead.world.entities[0].death = { startTick: world.tick, ageTicks: 0, despawnAfterTicks: null }
      reset(dead); press(1); press(4); step(1)
      assert.deepEqual(observe().command, idle)
      command({ ...idle, buttons: 2 }); step(1)
      assert.equal(observe().command.buttons, 2, 'Explicit streams are still consumed while dead')
      run([{ op: 'replay' }])
      evaluate('new Promise(resolve => requestAnimationFrame(() => { document.querySelector("#death-controls button").click(); resolve() }))')
      assert(player(observe()).health > 0)
      assert.equal(evaluate('!!document.querySelector("#death-controls")'), false)
    })
    check(backend, 'console has no errors or warnings', () => run([{ op: 'console', ms: 100, expectEmpty: true }]))
  }
} finally { cli('stop') }
const failed = results.filter(result => result.result === 'FAIL')
process.stdout.write(`${JSON.stringify({ passed: results.length - failed.length, failed: failed.length })}\n`)
if (failed.length) process.exitCode = 1
