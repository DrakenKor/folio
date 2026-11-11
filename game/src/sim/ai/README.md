# M1 content and AI handoff

Approved content lives in `../../content/m1.ts`; scenarios receive independent, id-sorted definitions in `world.content`.
`scenarios.ts` constructs the arena, fight and synthetic stress fixtures, and derives victory/defeat without mutable outcome state.

## Integration boundary

The worker owns content, AI, scenario construction and new fixtures. `core/loop.ts` and shared schemas remain untouched.
`stepEncounter(world, command, scenario)` is an executable adapter over the existing combat primitives, with two insertion points:

1. Call `driveEnemies(world, states)` after `advanceActors`/dummy wandering and before shared `selectAction` arbitration.
2. After `resolveContacts`, append `spawnFightWave(world)` events only for `m1-fight`, before publishing the completed tick.

The adapter includes the ordinary core pipeline only to make these insertions reviewable and runnable inside the owned paths.
Its M0 regression check compares events and canonical state against the unchanged core loop.

Proposed orchestrator changes: persist the scenario id on `World`, validate it, and set it in `buildScenario`.
Apply the two insertions to `core/loop.ts` and remove the adapter; fixture calls can then use core `step` and `verifyReplay`.
Persisted identity lets both the CLI and restored replays schedule waves without hidden module state or inferred content markers.
Update the snapshot schema/build and affected historical fixtures if required by that state change.
No shared type, validator, combat system, acceptance test, CLI or presentation file is changed here.

Until integrated, the standard `game:sim` CLI constructs M1 worlds but does not drive their AI or scheduled waves.
The existing `verifyReplay` also uses that unchanged loop. The fixture verifier explicitly uses `stepEncounter` instead.
This is a pending integration requirement, not a claim that standard core replay or CLI acceptance passes for M1 content.

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

The last command consumes the committed command script, checks all 121 committed hashes, and replays the entire adapter run.
`--record` regenerates inputs from the observation-only authoring policy plus the expected report/checkpoints.
The script records one intentional incoming strike, then a telegraph evasion; all 36 enemies use normal 72 health.
The owned content test proves exact equality with the approved data already exercised by the unchanged T1.2 harness.
Tests cover pursuit, active-only damage, aim commitment, both skill kills, player death, target loss, snapshot continuation and restart.

Seed 7: 7,200 ticks; 154 damage events; 2,592 outgoing / 20 incoming damage; 36 enemy deaths; zero player deaths; one dodge.
Span Cut hits 52 times, Fold Dart 101 times; player finishes with 100 health; `nextId` 139; final hash `6519cd05`.
All 121 full-run hashes and the rotated recorder window verify through the adapter.
Full `game:test`: 316 passed (26 new), one existing browser test skipped; all 165 T1.2 acceptance cases remain green.
`game:build` (including typecheck) and game ESLint pass; the build retains its existing large-chunk warning.
Browser/performance evaluation is deferred to integration; no browser is needed for this worker.
