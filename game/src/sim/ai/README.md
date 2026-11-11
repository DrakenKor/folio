# M1 content and AI handoff

Approved content lives in `../../content/m1.ts`; scenarios receive independent, id-sorted definitions in `world.content`.
`scenarios.ts` constructs the arena, fight and synthetic stress fixtures, and derives victory/defeat without mutable outcome state.

## Integration boundary

Core `step` drives every encounter, including CLI runs, browser ticks and `verifyReplay`.
`World.scenario` persists the scenario name through snapshots and recorder checkpoints.
`buildScenario` sets it; direct `createWorld` construction defaults to `empty`.
Restore accepts only names in `SCENARIO_NAMES`; missing or unknown identity fails validation.

1. `driveEnemies(world, states)` runs after actor advancement and dummy wandering, before `selectAction`.
2. After `resolveContacts`, `m1-fight` appends `spawnFightWave(world)` events before publishing the completed tick.

There is one simulation pipeline and replay verifier. Wave scheduling reads persisted identity,
so restored fights continue without external scenario arguments or inferred content markers.
The browser defaults to `m1-arena`; `?scenario=meadow-start` selects the M0 encounter.
Rendering and input retain their existing behavior.

## Enemy behavior

| Phase | Timing and intent |
| --- | --- |
| idle | Acquire nearest living hostile within 8 m; equal distance chooses the smaller actor id. |
| acquire | One published tick with a target, then enter chase. |
| chase | Straight-line desired movement at the definition's 1.8 m/s; shared turning and separation resolve travel. |
| telegraph | Within 1.2 m, submit Primary; shared selection captures aim and processes windup ages 0–23. |
| strike | Shared action ages 24–26; shared contacts apply damage once per target. |
| recover | Shared ages 27–50; no movement cancellation; completion at age 51 permits reconsideration. |
| die | Shared damage resolution enters death immediately; despawn after 30 world ticks. |

Hit-stop freezes processed action/phase ages; interrupted enemies reconsider after shared pause and knockback expire.
AI writes only its phase/target and consumes intent; shared primitives create actions, movement, hits, damage and death.
Target loss clears intent and returns idle. An already committed action finishes through shared age processing; it cannot retarget its direction.
All continuation state stays in `World`; there is no presentation import, wall clock or ambient randomness.

## Content and scenarios

- Span Cut: 24 damage, 1.7 m / 100°, 6/3/12 ticks; Fold Dart: 16 damage, 14 m/s, 0.12 m radius, 43 sweeps, 8/1/15 ticks.
- Both skills: no added cooldown, recovery movement cancellation after six ticks, two-tick pause and six-tick flash.
- Dodge: 0/10/8 ticks, 3 m, immunity ages [2,8), 30-tick cooldown, no recovery cancellation.
- Creaseback: 72 health, radius 0.45 m; strike 20 damage, 1.4 m / 70°, 24/3/24 ticks, acquire 8 m, attack 1.2 m.
- Player: 120 health, radius 0.32 m; full input remains `GAIT.runSpeed` = 2.521 m/s.
- Knockback: four unpaused ticks, 0.25 m for enemy targets and 0.15 m for the player, clipped by shared bounds/collision.
- `m1-arena`: player (−3,0), enemies (2,0), (3,2), (3,−2); victory on their deaths, defeat at player death.
- `m1-fight`: same trio at tick 0 and eligible boundaries 600..6600; no intermediate victory, heals, restores or resets.
- Scheduled waves require no remaining Creaseback, including corpses, and a living player; a blocked boundary is skipped.
- `m1-death.json`: idle for 900 ticks in the arena; tests reconstruct the encounter and reset the recorder after defeat.
- `m1-stress`: thirteen actors plus sixteen synthetic initial Fold Darts with ordinary payloads and expiry; no altered archetype.

Stress projectiles naturally leave the world after impact or 43 ticks. Refresh the fixture between peak-load measurement batches.
The 600-tick stress test proves deterministic operation, not sustained peak occupancy or browser performance targets.

Restart uses `buildScenario(name, seed)` and `Recorder.reset(newWorld)`; T1.7 integration must also clear disposable effects/history.
Arena centres are simulation (0,0), radius 8 m. Render positions add `meadow.field.player.x/z`; pointer coordinates subtract them.
The offset is seed-dependent, approximately (−6,+18); never add it inside simulation or query terrain there.
The renderer must keep solid scenery outside that translated circle.

## Verification

Run from the repository root, without installing anything:

```sh
fnm exec --using=24 npm run game:test
fnm exec --using=24 npm run game:build
fnm exec --using=24 npx --no-install eslint game
fnm exec --using=24 node --import tsx game/scenarios/m1-fight.ts
```

The last command consumes the committed command script, checks all 121 committed hashes, and verifies the full core replay.
`--record` regenerates inputs from the observation-only authoring policy plus the expected report/checkpoints.
The script records one intentional incoming strike, then a telegraph evasion; all 36 enemies use normal 72 health.
The owned content test proves exact equality with the approved data already exercised by the unchanged T1.2 harness.
Tests cover pursuit, active-only damage, aim commitment, both skill kills, player death, target loss, snapshot continuation and restart.

Seed 7: 7,200 ticks; 154 damage events; 2,592 outgoing / 20 incoming damage; 36 enemy deaths; zero player deaths; one dodge.
Span Cut hits 52 times, Fold Dart 101 times; player finishes with 100 health; `nextId` 139; final hash `bec54592`.
All 121 full-run hashes and the rotated recorder window verify through core `verifyReplay`.
Full `game:test`: 325 passed, one existing opt-in browser test skipped; all 165 T1.2 acceptance cases remain green.
`game:build` (including typecheck) and game ESLint pass; the build retains its existing large-chunk warning.
### Schema 3 fixture changes

Schema 3 / `m1-sim-v4` adds `world.scenario` to every canonical snapshot and hash.
The committed command script is unchanged. Comparing against the pre-integration adapter run
produced identical events and final gameplay state. Restoring only the old schema/build values
and removing scenario identity reproduced all 121 old fight checkpoints and both M0 hashes.

| Fixture | Previous hash | Current hash | Cause |
| --- | --- | --- | --- |
| M1 fight, tick 0 | `fe978795` | `138c8ac6` | Schema/build and `scenario: m1-fight`. |
| M1 fight, tick 7200 | `6519cd05` | `bec54592` | Same metadata change; all 121 checkpoints re-recorded. |
| M0 smoke, tick 0 | `77a71cc0` | `622e8f5e` | Schema/build and `scenario: meadow-start`. |
| M0 seed 7, idle tick 3600 | `37d0215e` | `a5e35af2` | Same metadata change; measured CLI baseline. |
| Animation combat snapshot | `cc27a64a` | `155c2847` | Schema/build and direct-world `scenario: empty`. |

The animation fixture retains identical content and actor data. Acceptance replays compute their
hashes at runtime and need no golden updates. Historical reports retain their recorded values.

### Browser integration verification

Brave on WebGPU passed `play.mjs observe` checks with seed 7 and the default `m1-arena` boot.
One normal dodge at tick 151 kept the player alive long enough to observe every enemy's first strike.

| Actor | Acquire | Chase | Telegraph | Strike |
| --- | --- | --- | --- | --- |
| 2 | 1 | 2 | 129 | 153 |
| 3 | 1 | 2 | 410 | 434 |
| 4 | 1 | 2 | 359 | 383 |

The player died at tick 440; all enemies returned to idle. Clicking Restart restored the initial
`02810f9b` hash, health `[120, 72, 72, 72]`, tick zero and an empty recorder; acquisition repeated.
Every observed checkpoint matched Node. Browser console capture contained no errors or warnings.

The committed 7,200-tick fight also ended at `bec54592` in Brave; its exported recorder replay verified.
The same CLI command returns tick 7200, hash `bec54592`, and one surviving player:

```sh
fnm exec --using=24 npm run game:sim -- --scenario m1-fight --seed 7 --ticks 7200 --script game/scenarios/m1-fight-commands.json
```

Explicit `?scenario=meadow-start` booted thirteen M0 actors, including twelve dummies, with hash `622e8f5e`.
The M0 smoke script passed movement, screenshots and console checks; movement arrived at tick 476 and stopped at 477.
Brave and Vite were stopped after verification. No changes outside the task's owned paths are proposed.
