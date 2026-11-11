# Expected failure before combat implementation

Baseline: T1.2 at `4ab3a13`, amended contracts at `f4ca5a4`; schema 2, build `m1-sim-v3`, Node `v24.16.0`.
The M0 step loop still implements 6 m/s movement without combat, circular bounds or gait; these failures define T1.3's target.

## Suite result

Command: `fnm exec --using=24 npm run game:test -- --reporter=json --outputFile=/tmp/t12b-harness-results.json`.

| Scope | Tests | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Existing M0 and T1.1 | 98 | 97 | 0 | 1 |
| Added T1.2b validation | 10 | 10 | 0 | 0 |
| Amended acceptance harness | 165 | 25 | 140 | 0 |
| Complete game suite | 273 | 132 | 140 | 1 |

The existing skipped test is the opt-in browser pack check; this task requires no browser.
All 140 failed tests report assertion failures; there are no non-assertion failures or failed setup suites.
Passing new cases cover fixture validation and existing absence/completion behavior; they do not establish working combat.

## First failing assertion by acceptance item

| Item | Behaviors | Test file | Tests / pass / fail | First failing assertion |
| --- | ---: | --- | --- | --- |
| 1. Movement, aim, dodge | 11 | `01-movement-dodge.test.ts` | 23 / 2 / 21 | Cardinal velocity is `{ x: 6, z: 0 }`; expected exactly `{ x: 2.521, z: 0 }`. |
| 2. Skills, phases | 10 | `02-skills-phases.test.ts` | 106 / 21 / 85 | Neutral melee age zero: action is `null`; expected `fixture-melee`, start tick 1, age 0. |
| 3. Sweeps, ordering | 5 | `03-swept-order.test.ts` | 7 / 0 / 7 | Crossed target remains at `72` health; expected `67`. |
| 4. Damage, death | 11 | `04-damage-death.test.ts` | 16 / 0 / 16 | Incoming dart leaves player health at `120`; expected `104`. |
| 5. Snapshots | 8 | `05-snapshots.test.ts` | 10 / 2 / 8 | Moving gait phase remains `0`; expected an increase. |
| 6. Replays | 3 | `06-replays.test.ts` | 3 / 0 / 3 | The 7,200-tick stream produces `0` damage events; expected a positive count. |

Phase probes cover before/at/after action start, active start, recovery start and completion for both neutral skills, both approved skills, the strike and both dodge definitions.
Contact-free phase probes isolate unpaused ages; separate tests check damage windows, hit deduplication, interruption and impact pause.
Snapshot tests compare sixty subsequent hashes, events and actor/projectile outcomes, with assertions that each named state was reached.

## Approved amendments

- Full player input asserts `GAIT.runSpeed` exactly; diagonal travel matches, and enemies use their definition's `moveSpeed`.
- Circular bounds cover locomotion, dodge and cardinal/diagonal knockback, including an offset centre and full actor-centre reach.
- Arena validation requires a finite centre and positive finite radius; `createWorld` keeps its existing null, unbounded default.
- Lethal damage creates death state for both AI-referenced enemies and AI-free targets; no acceptance fixture seeds death state.
- Enemy death reads definition `deathTicks` and expires exactly; AI-free death persists beyond that duration without colliding.
- Fold Dart retains 43 sweeps at 14 m/s (10.033 m); its lifetime test checks total travel and expiry without a travel budget.
- Snapshot validation rejects rectangular/malformed arenas and death durations inconsistent with AI; build `m1-sim-v2` is incompatible.

## Fixture hashes

| Fixture | Previous (`m1-sim-v2`) | Current (`m1-sim-v3`) | Reason |
| --- | --- | --- | --- |
| `m0-smoke.json`, meadow seed 7, tick 0 | `2a5c16ec` | `77a71cc0` | Build id changes in the canonical envelope and world. |
| Meadow seed 7, 3,600 idle ticks | `0e577070` | `ceb71dac` | The same build-only change; M0 systems remain unchanged. |

Computed through `buildScenario`, `step`, `IDLE_COMMAND` and `hashWorld` under Node 24.
Changing only each world's build back to `m1-sim-v2` reproduces its previous hash; both arenas remain null.
Only the smoke initial hash is pinned in a scenario; historical M0 reports retain their original measurements.

## Replay evidence

- The full tick-zero replay verifies all 121 hashes at ticks 0, 60, …, 7200, including its final hash.
- The tick-7200 recorder export starts at 3600; continuation to 9007 rotates the retained start to 5400.
- Both retained exports verify; the final retained window has 3,607 commands and 62 hashes, ending at 9007.
- Removing combat buttons during ticks 1–60 currently reports `ok: true`; the required first divergence is tick 60.
- Real combat assertions keep the currently inert fight and snapshot continuations from passing on serialization alone.

## Verification

- `fnm exec --using=24 npm run game:test -- --exclude '**/acceptance/**'`: 107 pass, one existing browser test skipped.
- `fnm exec --using=24 npx --no-install eslint game`: passes.
- `fnm exec --using=24 npm run game:build`: typecheck and production build pass; Vite reports its existing large-chunk warning.
- `git diff --check`: passes. No browser, dependency installation or combat-system implementation.
- Production changes are limited to contract types/validation and the build id; harness changes apply the approved decisions separately.

The 48 covered behaviors and settled fixture readings are recorded in [BEHAVIORS.md](BEHAVIORS.md).
