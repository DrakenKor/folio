# Expected failure before combat implementation

Baseline: `e1db3d8`, schema 2, build `m1-sim-v2`; Node `v24.16.0`.
The M0 step loop implements no combat or gait integration; these failures define T1.3's acceptance target.

## Suite result

Command: `fnm exec --using=24 npm run game:test`.
Recorded with `--reporter=json --outputFile=/tmp/t12-harness-results.json` for assertion inspection.

| Scope | Tests | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Existing M0 and T1.1 | 98 | 97 | 0 | 1 |
| New acceptance harness | 161 | 25 | 136 | 0 |
| Complete game suite | 259 | 122 | 136 | 1 |

The existing skipped test is the opt-in browser pack check; this task requires no browser.
All 136 failed tests report assertion failures; there are no non-assertion failures or failed setup suites.
Passing new cases cover fixture validation and existing absence/completion behavior; they do not establish working combat.

## First failing assertion by acceptance item

| Item | Behaviors | Test file | Tests / pass / fail | First failing assertion |
| --- | ---: | --- | --- | --- |
| 1. Movement, aim, dodge | 10 | `01-movement-dodge.test.ts` | 21 / 2 / 19 | Independent aim: stored aim is `0`; expected approximately `π/2`. |
| 2. Skills, phases | 10 | `02-skills-phases.test.ts` | 106 / 21 / 85 | Neutral melee age zero: action is `null`; expected `fixture-melee`, start tick 1, age 0. |
| 3. Sweeps, ordering | 5 | `03-swept-order.test.ts` | 7 / 0 / 7 | Crossed target remains at `72` health; expected `67`. |
| 4. Damage, death | 11 | `04-damage-death.test.ts` | 14 / 0 / 14 | Incoming dart leaves player health at `120`; expected `104`. |
| 5. Snapshots | 8 | `05-snapshots.test.ts` | 10 / 2 / 8 | Moving gait phase remains `0`; expected an increase. |
| 6. Replays | 3 | `06-replays.test.ts` | 3 / 0 / 3 | The 7,200-tick stream produces `0` damage events; expected a positive count. |

Phase probes cover before/at/after action start, active start, recovery start and completion for both neutral skills, both approved skills, the strike and both dodge definitions.
Contact-free phase probes isolate unpaused ages; separate tests check damage windows, hit deduplication, interruption and impact pause.
Snapshot tests compare sixty subsequent hashes, events and actor/projectile outcomes, with assertions that each named state was reached.

## Replay evidence

- The full tick-zero replay verifies all 121 hashes at ticks 0, 60, …, 7200, including its final hash.
- The tick-7200 recorder export starts at 3600; continuation to 9007 rotates the retained start to 5400.
- Both retained exports verify; the final retained window has 3,607 commands and 62 hashes, ending at 9007.
- Removing combat buttons during ticks 1–60 currently reports `ok: true`; the required first divergence is tick 60.
- Real combat assertions keep the currently inert fight and snapshot continuations from passing on serialization alone.

## Verification and harness correction

- `fnm exec --using=24 npx --no-install eslint game`: passes.
- `fnm exec --using=24 npm run game:build`: typecheck and production build pass; Vite reports its existing large-chunk warning.
- `git diff --check`: passes. No dependency, content, engine or other production file changes are required by this harness.
- Initial execution exposed a harness defect: late-command selection found no attack command when missing combat blocked traversal.
- The mutation test now uses the known initial Primary command and removes combat input through the first hash, preserving the divergence requirement.
- Re-execution confirms the counts above and reaches both divergence assertions; implementation behavior remains the expected missing-combat failure.

Contract readings and proposed clarifications are recorded in [BEHAVIORS.md](BEHAVIORS.md).
