import { hashWorld, serialize, step } from '../src/sim/core'
import { Button, type Command } from '../src/sim/core/types'
import { advance, command, fixture, incoming, m1Content, target } from '../src/sim/acceptance/fixtures'

/** Reach the eight acceptance snapshot states through commands, then retain their Node continuation hashes. */
export function restoreFixtures() {
  return ['changing-gait', 'windup', 'active', 'recovery', 'dodge', 'impact-pause', 'projectile-flight', 'death'].map(name => {
    const { world, player } = fixture(['impact-pause', 'death'].includes(name) ? m1Content() : undefined, name === 'death' ? { health: 10 } : {})
    let continuation: Command = command()
    switch (name) {
      case 'changing-gait':
        advance(world, 8, command(0, { x: 0.25, z: 0 }))
        advance(world, 8, command(0, { x: 1, z: 0 }))
        continuation = command(0, { x: 0, z: 0.5 }, { x: -100, z: 0 })
        break
      case 'windup': advance(world, 2, command(Button.Primary)); continuation = command(0, undefined, { x: 0, z: 100 }); break
      case 'active': target(world); advance(world, 3, command(Button.Primary)); break
      case 'recovery': advance(world, 5, command(Button.Primary)); continuation = command(0, { x: 1, z: 0 }); break
      case 'dodge': advance(world, 2, command(Button.Dodge)); incoming(world, player); continuation = command(Button.Dodge); break
      case 'impact-pause': target(world); advance(world, 7, command(Button.Primary)); break
      case 'projectile-flight': target(world, { x: 2.5, z: 0 }, { radius: 0.1 }); advance(world, 4, command(Button.Secondary)); break
      case 'death': incoming(world, player); step(world, command()); continuation = command(Button.Primary | Button.Dodge, { x: 1, z: 0 }); break
    }
    const snapshot = serialize(world)
    const hash = hashWorld(world)
    advance(world, 60, continuation)
    return { name, snapshot, hash, continuation, continuedHash: hashWorld(world) }
  })
}
