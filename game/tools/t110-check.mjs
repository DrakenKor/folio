// Recovery regressions through the existing Brave harness and player controls.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const tool = fileURLToPath(new URL('./play.mjs', import.meta.url))
const origin = process.env.PLAY_ORIGIN ?? 'http://localhost:5199'
const env = { ...process.env, PLAY_CDP_PORT: process.env.PLAY_CDP_PORT ?? '9579', PLAY_HEADLESS: '1' }
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
const paint = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))'
const observe = () => cli('observe')[0]

function loseAndRecover() {
  evaluate(`(async () => {
    __game.debug.loseDevice();
    while (!document.querySelector('#graphics-stopped button')) await new Promise(resolve => setTimeout(resolve, 10));
  })()`)
  const lost = observe()
  assert(lost.paused)
  const recovered = run([{ op: 'recover' }]).find(row => row.command === 'recover').state
  return { lost, recovered }
}

try {
  for (const backend of ['webgpu', 'webgl']) {
    for (const name of ['running recovery', 'paused recovery', 'recovered defeat restart']) {
      try {
        cli('boot', `${origin}/play/?view=basic&backend=${backend}&scenario=m1-arena&seed=7&paused=0`)
        assert.equal(evaluate('__game.backend'), backend === 'webgl' ? 'webgl2' : 'webgpu')
        evaluate(`__game.pause(); __game.scenario('m1-arena', 7); __game.step(${name === 'recovered defeat restart' ? 900 : 60})`)
        const start = name === 'recovered defeat restart' ? evaluate(`(() => {
          const dead = __game.snapshot();
          __game.scenario('m1-arena', 7); const fresh = __game.snapshot(); __game.restore(dead); return fresh;
        })()`) : null
        if (name === 'running recovery') evaluate('__game.resume()')
        const { lost, recovered } = loseAndRecover()
        if (name === 'running recovery') {
          assert.equal(recovered.paused, false, 'Running game stayed paused after Reload')
          evaluate('new Promise(resolve => setTimeout(resolve, 350))')
          const after = observe()
          assert(after.tick > lost.tick, 'Recovered clock did not advance')
        } else {
          assert.equal(recovered.hash, lost.hash, 'Reload changed the saved snapshot')
          assert.equal(recovered.tick, lost.tick)
          assert.equal(recovered.paused, true)
          evaluate('new Promise(resolve => setTimeout(resolve, 350))')
          assert.equal(observe().hash, lost.hash, 'Paused recovery advanced')
          if (name === 'recovered defeat restart') {
            assert.equal(recovered.player.health, 0, 'Fixture did not reach defeat')
            assert.equal(evaluate('!document.querySelector(".hud-outcome").hidden'), true)
            evaluate(`document.querySelector('.hud-outcome button').click(); ${paint}`)
            assert.equal(evaluate('__game.snapshot()'), start, 'Try again retained the recovered dead state')
            assert.equal(evaluate('document.querySelector(".hud-outcome").hidden'), true)
          }
        }
        results.push({ backend, check: name, result: 'PASS', lostTick: lost.tick, recoveredTick: recovered.tick })
      } catch (error) { results.push({ backend, check: name, result: 'FAIL', reason: error.message }) }
      console.log(JSON.stringify(results.at(-1)))
    }
  }
} finally { cli('stop') }
const failed = results.filter(result => result.result === 'FAIL').length
console.log(JSON.stringify({ passed: results.length - failed, failed }))
if (failed) process.exitCode = 1
