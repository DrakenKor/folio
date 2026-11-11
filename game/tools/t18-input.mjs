// Run T1.4b's behavior checks against the current camera and encounter HUD.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const revision = '745f14e'
const root = fileURLToPath(new URL('../../', import.meta.url))
const source = execFileSync('git', ['show', `${revision}:game/src/debug/combat-input-check.mjs`], { encoding: 'utf8' })
const rootLine = "const root = fileURLToPath(new URL('../../../..', import.meta.url))"
const toolLine = "const tool = fileURLToPath(new URL('../../tools/play.mjs', import.meta.url))"
assert(source.includes(rootLine) && source.includes(toolLine), 'Committed input harness locations changed')
const adapted = source.replace(rootLine, `const root = ${JSON.stringify(root)}`)
  .replace(toolLine, `const tool = ${JSON.stringify(join(root, 'game/tools/play.mjs'))}`)
  .replace('__game.pause(); __game.restore(${JSON.stringify(JSON.stringify(fixture))})', '__game.pause(); __game.restore(${JSON.stringify(JSON.stringify(fixture))}); __game.camera.bookmark("player")')
  .replace('#death-controls button', '#encounter-hud .hud-outcome button')
  .replace('!!document.querySelector("#death-controls")', '!document.querySelector("#encounter-hud .hud-outcome").hidden')
mkdirSync('game/.play-out/t18/checks', { recursive: true })
writeFileSync('game/.play-out/t18/checks/input-adapter.json', JSON.stringify({ revision,
  adaptations: ['root path', 'play tool path', 'freeze camera during pointer expectations', 'current restart selector', 'current HUD hidden-state observation'],
  behavioralExpectationsChanged: false }, null, 2))
await import(`data:text/javascript;base64,${Buffer.from(adapted).toString('base64')}`)
