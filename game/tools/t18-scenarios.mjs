// Generate the browser counterpart without changing the authored command fixture.
import { readFileSync, writeFileSync } from 'node:fs'

const commands = JSON.parse(readFileSync('game/scenarios/m1-fight-commands.json', 'utf8'))
const expected = JSON.parse(readFileSync('game/scenarios/m1-fight.json', 'utf8'))
export const frames = { approach: 120, 'incoming-hit': 153, 'melee-contact': 166, dodge: 196,
  'fold-dart-flight': 221, 'fold-dart-hit': 225, 'enemy-death': 270 }
const boundaries = [...new Set([...expected.checkpoints.map(([tick]) => tick), ...Object.values(frames)])].sort((a, b) => a - b)
const steps = [{ op: 'eval', expression: `window.__t18Commands=${JSON.stringify(commands)}; window.__t18Hashes=[]; true`, expect: true }]
let previous = 0
for (const tick of boundaries) {
  if (tick > previous) steps.push({ op: 'eval', expression: `__game.simulate(__t18Commands,${tick - previous}); __game.state('tick')`, expect: tick })
  const checkpoint = expected.checkpoints.find(([at]) => at === tick)
  if (checkpoint) {
    steps.push({ op: 'expectHash', hash: checkpoint[1] })
    steps.push({ op: 'eval', expression: '__t18Hashes.push([__game.state("tick"),__game.hash()]); true', expect: true })
  }
  for (const [name, at] of Object.entries(frames)) if (at === tick) steps.push({ op: 'shot', bookmark: 'meadow-player', out: `fixed/${name}-${tick}.png` })
  previous = tick
}
steps.push({ op: 'artifact', out: 'hashes.json', expression: '__t18Hashes' },
  { op: 'replay' }, { op: 'artifact', out: 'retained-replay.json', expression: '(async()=>{const text=await __game.exportReplay();return {text,tick:__game.state("tick"),hash:__game.hash()}})()' },
  { op: 'console', expectEmpty: true })
writeFileSync('game/scenarios/m1-fight-browser.json', JSON.stringify({ scenario: 'm1-fight', seed: 7, steps }, null, 2) + '\n')
