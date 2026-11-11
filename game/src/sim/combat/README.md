# Deterministic combat integration

`core/loop.ts` follows [CONTRACT.md](../CONTRACT.md#fixed-system-and-hit-resolution-order), with no module-owned continuation state.
Timers, actions, movement/gait, projectile flight and serial contact resolution all publish through `World` and ordered events.

For T1.5, insert AI intent generation after `advanceActors` and before the `selectAction` loop, iterating living actors by id.
Use `consumeIntent(actor, state, command)` with the tick's `ActorTick`, then let `selectAction` apply the shared arbitration.
Entry button history and position remain available even when AI replaces the default idle intent; blocked edges are consumed.
Enemy ordinary speed comes from `ai.enemyId`; targeting and AI phase transitions remain T1.5's responsibility.

## Final tuning

Content owns skill timing; the systems introduce no overrides or tuning changes.

| Action | Windup / active / recovery | Active ages | Recovery starts | Completes |
| --- | --- | --- | --- | --- |
| Melee | 6 / 3 / 12 | 6–8 | 9 | 21 |
| Projectile | 8 / 1 / 15 | 8 | 9 | 24 |
| Dodge | 0 / 10 / 8 | 0–9 | 10 | 18 |
| Enemy strike | 24 / 3 / 24 | 24–26 | 27 | 51 |

Default dodge: 3 m, immunity `[2, 8)`, cooldown 30 ticks. Content fixtures retain 2-tick pause and 6-tick flash.

## Verification and QA handoff

- Full `fnm exec --using=24 npm run game:test`: 271 passed, one failed, one existing browser test skipped.
- All 165 T1.2 acceptance cases pass, including snapshot continuation, replay divergence and recorder rotation through tick 9007.
- `fnm exec --using=24 npm run game:build` and `fnm exec --using=24 npx --no-install eslint game` pass.
- Independent seed-7, 7200-command runs match events, ids, canonical state and 121 hashes; final hash `e7da496b`.
- Those runs produce 133 damage events and 36 deaths; shared allocator ends at `nextId = 86`.
- Headless smoke retains initial hash `77a71cc0`, arrives at tick 476, stops at 477, and keeps twelve dummies wandering.
- Browser rendering checks were omitted per the brief; the build retains its existing large-chunk warning.

The untouched [legacy test](../core/core.test.ts#L145) contradicts contract lines 130–133 at assertions 150, 152 and 156.
Its sixty forward commands produce x = 2.521 and facing = 0; the following idle command turns by 15 degrees.
It instead requires x = 6, aim-facing greater than 90 degrees, and unchanged idle facing. Coincident-circle separation still reaches 1 m.
QA should update those expectations to the approved locomotion contract; no type or tuning amendment is proposed.
The contract's compatibility section also retains historical smoke ticks 195/196; current locomotion gives 476/477 within the existing timeout.
