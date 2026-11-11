/** Queue the authored command before each normal-clock input sample; retain rendered frames without stepping. */
export async function normalFight(script, expected, frames, warmupTicks) {
  const game = window.__game
  const view = game.debug.view
  const advance = view.advance
  const render = view.render
  window.__t18Captures = {}
  const run = (ticks, capture) => new Promise((resolve, reject) => {
    let entry = 0
    let seen = -1
    let lastTime
    let started
    const intervals = []
    const hashes = []
    const captured = []
    const pending = new Set(Object.keys(frames))
    const deadline = setTimeout(() => finish(new Error('Normal-clock fight timed out')), 150000)
    function finish(error) {
      clearTimeout(deadline)
      game.pause()
      view.advance = advance
      view.render = render
      if (error) reject(error)
      else {
        const sorted = [...intervals].sort((a, b) => a - b)
        const at = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0
        resolve({ tick: game.state('tick'), hash: game.hash(), hashes, intervals,
          frameMs: { median: at(0.5), p95: at(0.95), samples: intervals.length },
          durationMs: lastTime - started, captured })
      }
    }
    view.advance = function(world) {
      advance.call(this, world)
      if (world.tick !== seen) {
        seen = world.tick
        if (world.tick % 60 === 0) hashes.push([world.tick, game.hash()])
      }
      if (world.tick >= ticks) game.pause()
      else {
        while (script[entry + 1]?.tick <= world.tick) entry++
        game.cmd(script[entry].command)
      }
    }
    view.render = function() {
      try {
        render.call(this)
        const now = performance.now()
        started ??= now
        if (lastTime !== undefined) intervals.push(now - lastTime)
        lastTime = now
        if (capture) for (const name of pending) {
          if (seen < frames[name]) continue
          const stage = document.querySelector('#stage')
          const image = document.createElement('canvas')
          image.width = stage.width
          image.height = stage.height
          image.getContext('2d').drawImage(stage, 0, 0)
          window.__t18Captures[name] = image.toDataURL('image/png')
          captured.push({ name, requestedTick: frames[name], actualTick: seen, width: image.width, height: image.height })
          pending.delete(name)
        }
        if (seen >= ticks) finish()
      } catch (error) { finish(error) }
    }
    game.camera.follow()
    view.advance(game.state())
    game.resume()
  })
  game.pause()
  game.scenario('m1-fight', 7)
  await run(warmupTicks, false)
  game.scenario('m1-fight', 7)
  const result = await run(expected.ticks, true)
  return { ...result, seed: 7, scenario: 'm1-fight', backend: game.backend,
    driver: 'normal Clock; cmd queued by view.advance before each input sample', warmupTicks,
    viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
    userAgent: navigator.userAgent, build: game.build }
}
