# T1.10 review fixes

All three findings are fixed, with regression failures observed before implementation.

| Finding | Fix | Before → after |
| --- | --- | --- |
| Recovery pause | Save `clock.userPaused` during graphics loss. | Running recovery failed on both backends → passed; deliberately paused recovery still passes. |
| Recovered defeat restart | Rebuild from the current world's scenario and seed. | Unit and HUD checks retained dead tick 900 → fresh tick 0, full health, same scenario/seed. |
| Simultaneous feedback | Deduplicate by damage-event object identity in a `WeakSet`. | Two Fold Darts dealt 32 damage but produced one number → two numbers, once each. |

Damage events are transient objects supplied directly by the clock; each object identifies one contact.
Repeated frame synchronization remains deduplicated, numbers expire, and rendering preserves the snapshot.
No simulation, schema, snapshot or hash changes were needed.

Changed paths: `src/main.ts`, `src/debug/api{,.test}.ts`, `src/render/combat/feedback{,.test}.ts`,
`tools/play.mjs`, `tools/t110-check.mjs` and this report, all under `game/`.

All commands used `fnm exec --using=24`; nothing was installed.

| Check | Command after that prefix | Result |
| --- | --- | --- |
| Regression units | `npm run game:test -- game/src/debug/api.test.ts game/src/render/combat/feedback.test.ts` | 6 passed; the two added tests failed before their fixes. |
| Browser recovery and restart | `node game/tools/t110-check.mjs` | 6/6 passed across WebGPU and WebGL2; 4/6 failed before fixes. |
| Full suite | `npm run game:test` | 328 passed, one existing opt-in browser test skipped. |
| Typecheck/build | `npm run game:build` | Passed; existing chunk-size advisory remains. |
| Lint | `npx --no-install eslint game` | Passed. |
| Input | `env PLAY_ORIGIN=http://localhost:5199 PLAY_CDP_PORT=9579 node game/src/debug/combat-input-check.mjs` | 36/36 passed across both backends. |
| Headless fight | `npm run --silent game:sim -- --scenario m1-fight --seed 7 --ticks 7200 --script game/scenarios/m1-fight-commands.json` | `bec54592`. |
| Browser fight | `env PLAY_CDP_PORT=9579 PLAY_HEADLESS=1 node game/tools/play.mjs run game/scenarios/m1-fight-browser.json --out-dir game/.play-out/t110/<backend>` | Both backends: 121 hashes match, replay verifies, console empty, final hash `bec54592`. |

Vite used `npm run game:dev -- --port 5199 --strictPort` on `http://localhost:5199/play/`.
Each browser fight booted that URL with `?backend=<webgpu|webgl>&scenario=m1-fight&seed=7` through `play.mjs boot`.
Fight evidence remains local under `game/.play-out/t110/{webgpu,webgl}/`.
Brave and Vite are stopped; ports 9579 and 5199 are free.
