# M2 integration and evaluation

Game build `2a09d96`. Node 24.16.0 on Apple M4 Pro, 48 GB, macOS 27.2.
Isolated headless Brave 157.1.99.57 on CDP 9584 used Chromium 157.0.8103.79.
Vite dev reported 79 ms and served `http://127.0.0.1:5204/play/`. Vite preview served `http://127.0.0.1:5205/play/`.
`public/play/` and the default Next export `out/play/` matched byte-for-byte.

## Acceptance

All 164 M2 Node cases passed. The six suites passed 23 damage, 49 actions, 29 progression, 27 content, 25 saves and 11 replay cases.
The full game run passed 546 tests in 31 files with one opt-in test excluded from that invocation.
The separately enabled legacy play suite passed 7/8 tests. Both 2880×1800 captures passed before the opt-in iframe assertion below.
Game typecheck/build, ESLint and the default site build passed. Vite retained its existing chunk advisory and the site emitted a Three Clock deprecation during prerender.

The commands used Node 24. The frozen browser run used `m2-acceptance.mjs --locks both` for each combination.

| Check | Dev WebGPU | Dev WebGL2 | Static WebGPU | Static WebGL2 |
| --- | --- | --- | --- | --- |
| Frozen M2 browser cases | 23/25 | 22/25 | 22/25 | 21/25 |
| Frozen failures | B11, B12 | B03, B11, B12 | L04, B11, B12 | B03, L04, B11, B12 |
| L08 timer, pagehide and debug scenario isolation | Pass | Pass | Pass | Pass |
| B08/B10 recovery priority and stale takeover | Pass | Pass | Pass | Pass |
| Real locks, missing locks and storage faults, except L04 above | Pass | Pass | Pass | Pass |
| Frozen Runtime/Log warning and error entries | 0 | 0 | 0 | 0 |
| Reconciled DOM input runner | 19/19 | 19/19 | 19/19 | 19/19 |
| Real graphics recovery modes | 3/3 | 3/3 | 3/3 | 3/3 |
| Exact graphics snapshot and released input | Pass | Pass | Pass | Pass |
| M1 save-independent restore states and Node continuations | 8/8 | 8/8 | 8/8 | 8/8 |
| M0 smoke, bookmarks, background and iframe blur | Pass with advisory | Pass with advisory | Pass | Pass |
| M1 7,200 ticks, 121 checkpoints and F8 replay | Pass with advisory | Pass with advisory | Pass | Pass |
| M2 parity with Node | 20/20 | 20/20 | 20/20 | 20/20 |
| Transition saves and debug replay isolation | Pass | Pass | Pass | Pass |
| Supplemental 1440×900 and 1024×768 interface captures | 10 | 10 | 10 | 10 |
| Final runtime warnings and errors | 0 | 0 | 0 | 0 |

The frozen scripts, assertions and thresholds stayed unchanged. The balance fixture and four scenario SHA-256 digests match `EXPECTED.md`.
All 32 restore captures matched pose and continuation hashes. The largest pixel difference was 0.017%, below the 0.5% threshold.
The startup path treats a URL snapshot as an explicit world. The graphics Reload control can recover an exact snapshot from the matching launch URL.
Recovery from a player entry also requires matching save generations and current writer authority or matching read-only status.

| Finding | Evidence and proposed change |
| --- | --- |
| B03 reads pre-import HUD on WebGL2 | The import already succeeded. The immediate DOM can show 0/30. After paint, both stores show 30/30. QA should wait for the rendered counters. |
| B11 reads before Reset commits | Immediate character points remain 3. After the lock transaction commits, points are 4, allocations are empty and a later save succeeds. QA should await commit completion. |
| B12 reads before the HUD paints | The state immediately contains one or three drops. After paint, Start shows the count. F collects a drop, and Start clears the remainder. QA should wait for the label. |
| L04 has no static barrier | Both static builds omit the development-only API. Both dev runs passed the real lock barrier. QA should scope L04 to dev or use an opt-in static QA build. |
| First dev probe interrupted L08 | A Vite reload reset the timer while the first exploratory run waited. All four complete, uninterrupted matrix runs passed L08. |
| Explicit legacy URL followed by a debug M2 replacement | The M2 HUD sees an uninitialized SaveController as blocked. The reconciled input runner boots the clearing for its M2-only case. Platform can expose writerless status for explicit debug entries. |
| Legacy dev console assertions count an informational React message | Their literal exits show the advisory. The evaluator retains it, verifies the gameplay assertions and runs any later step. QA can gate console warnings and errors. |
| Legacy opt-in iframe samples before HUD unmount | The child boots a blocked clearing. Immediately after restoring M0 it still reports paused with a visible modal. After paint it is focused, running and modal-free. QA can boot the iframe directly into the debug scenario or wait for unmount. |
| Evaluation setup retries | The first HMR probe removed a live module and caused test-only Vite errors. Cleanup now follows browser shutdown. The first warm probe lost emulation when CDP disconnected. A single held CDP connection now covers each capture. |

The supplemental browser probe records writes after Start, defeat and Return to marker, and verifies debug replay cannot overwrite save bytes.
Quality captures include full inventory comparison, completed graph and refund, both fold states, damage, save faults, takeover and read-only mode.
They include the browser DOM at 1440×900 and 1024×768. Independent code review, director review and the navigator session remain with the orchestrator.

## Balance

Both frozen builds met the gate in 10/10 seeds. Each run killed 36/36 actors over 7,200 ticks and finished at full health.

| Build | Health per seed | Action per seed | Applied damage apportioned to weight / heat / gale | Post-defence weight / heat / gale |
| --- | --- | --- | --- | --- |
| Weight/melee | 197/197 | Span Cut | 2,592 / 0 / 0 | 2,706.74 / 0 / 0 |
| Gale/cast | 205/205 | Rill Fan | 183.46 / 0 / 2,408.54 | 209.85 / 0 / 2,754.94 |

The applied type split apportions the event's rounded, health-clamped total by the captured recipe's post-defence shares.
Each build was loaded once and used the frozen ordinary commands throughout combat. Both shared a five-base, eight-affix tier-2 budget.
The rotating replay kept ticks 3600–7200. The full run retained 121 independent state checkpoints.
The four browser combinations matched all 2,420 M2 checkpoints and all 20 replay results per combination.
The M1 fixture final hash was `0fbf3195` in Node and all four browser combinations.
The warm fight used the frozen Weight/melee controller and seed 7 through the normal browser clock after 600 warm-up ticks.

| Seed | Weight/melee hash | Gale/cast hash |
| --- | --- | --- |
| 1 | `699a3e14` | `52e2d96f` |
| 2 | `d0507f32` | `e5f27b53` |
| 3 | `fec7e911` | `884709a6` |
| 4 | `ff4a5499` | `e5bc7b6a` |
| 5 | `0f95ad8b` | `be705483` |
| 6 | `75bc7a90` | `64a3d5da` |
| 7 | `0a571842` | `1aac610a` |
| 8 | `639ec63f` | `6d8c6765` |
| 9 | `787d3834` | `50ef7a0b` |
| 10 | `873b93b0` | `9c57c05a` |

## Measurements

Stress used seed 7 and 600 timed ticks after 120 warm-up ticks.
Each tick began with 200 actors, 64 live projectiles and three ailments per actor. Consumed or expired shots were replenished before the next tick.
The lowest post-tick projectile count was 53. All actors carried 24 nodes, two active shapes, five bases, eight affixes and two legal folds per action.
The run recorded 3,494 resolved direct contacts and 4,000 Emberprint evaluations, for 7,494 total damage evaluations. Start-up stat/recipe derivation and first tick are timed separately.

| Environment | Stress median / p95 | Cold stats and recipes / first tick | 1,000 dummies median / p95 |
| --- | --- | --- | --- |
| Node | 0.309 / 0.524 ms | 19.480 / 2.888 ms | 1.085 / 1.603 ms |
| Dev WebGPU | 0.300 / 0.400 ms | 13.300 / 1.200 ms | 1.100 / 1.300 ms |
| Dev WebGL2 | 0.300 / 0.400 ms | 13.700 / 1.300 ms | 1.100 / 1.300 ms |
| Static WebGPU | 0.300 / 0.400 ms | 13.800 / 1.300 ms | 1.100 / 1.300 ms |
| Static WebGL2 | 0.300 / 0.400 ms | 13.700 / 1.200 ms | 1.100 / 1.300 ms |

Stress timing budgets are 2 ms median and 4 ms p95. The dummy median budget is 2 ms, with a 1.032 ms Node baseline from M1.
Stress and dummy hashes were `bfe4da10` and `068c98bb` respectively in Node and Brave.

| Warm static fight, 1440×900 at 1.5× | Median / p95 | Duration | Frame intervals | Result |
| --- | --- | --- | --- | --- |
| WebGPU | 16.7 / 16.7 ms | 120.012 s | 7,201 | Pass |
| WebGL2 | 16.7 / 16.7 ms | 120.012 s | 7,195 | Pass |

The warm targets are 16.7 ms median and 20 ms p95. Both real-time runs finished with the frozen seed-7 hash `0a571842`.

| Fresh browser | Ready | Dev HMR |
| --- | --- | --- |
| Dev WebGPU | 530 ms | 26 ms |
| Dev WebGL2 | 890 ms | 56 ms |
| Static WebGPU | 425 ms | — |
| Static WebGL2 | 598 ms | — |

Both dev cold-ready runs met the 2-second target. The HMR module retained the same simulation hash.

The max-population save contained 65 items and 128 affixes and used 16,838 UTF-8 bytes or 33,676 UTF-16 bytes.
Both encodings passed at the 1,048,576-byte boundary. The first representable excess was rejected at 1,048,578 UTF-16 bytes and 1,048,579 UTF-8 bytes.
Frozen S07 also verifies preservation of the previous bytes and character on rejection.

| Size or build budget | Measured | Budget | Result |
| --- | --- | --- | --- |
| First-playable transfer | 852,045 bytes across 6 requests | 30 MiB | Pass |
| Gzip game JavaScript | 0.40 MiB | 3 MiB | Pass |
| Game deploy | 1.82 MiB | 500 MiB | Pass |
| Whole export | 61.09 MiB | 900 MiB | Pass |
| Game git history | 1.28 MiB | 50 MiB | Pass |
| Max-population save, storage encoding | 33,676 bytes | 1 MiB | Pass |
| `npm run game:build` elapsed | 2.340 s | 5 s | Pass |
| Default `npm run build` elapsed | 9.121 s | — | Pass |

## Evidence and reproduction

Raw commands, timings, case failures and PNGs are under `game/.play-out/m2/` in this worktree.
The `commands/` directory contains command logs. Each build/backend directory contains `acceptance.json`, two-size screenshots and an `evaluation/` directory.
`evaluation.json` preserves the first matrix. `evaluation-dev.json` and `evaluation-warm.json` contain the corrected dev and performance runs.
`balance.json` retains all per-seed results and hashes. `bench.json` and browser benchmark artifacts retain all sample intervals.
Each `warm-<backend>/fight-perf.json` retains the full interval stream from the normal-clock fight.
Brave and its temporary profiles were closed. Dev port 5204, preview port 5205 and CDP port 9584 were clear after shutdown.

```sh
export PLAY_CDP_PORT=9584
export PLAY_HEADLESS=1
export M2_DEV_URL=http://127.0.0.1:5204/play/
export M2_STATIC_URL=http://127.0.0.1:5205/play/
fnm exec --using=24 npm run game:dev -- --host 127.0.0.1 --port 5204 --strictPort
fnm exec --using=24 npm run game:build
fnm exec --using=24 npm run game:test
fnm exec --using=24 npx --no-install eslint game
fnm exec --using=24 npm run build
fnm exec --using=24 npx --no-install vite preview --config game/vite.config.mts --host 127.0.0.1 --port 5205 --strictPort
fnm exec --using=24 node game/tools/m2-acceptance.mjs --url "$M2_DEV_URL" --backend webgpu --locks both
fnm exec --using=24 node game/tools/m2-acceptance.mjs --url "$M2_DEV_URL" --backend webgl --locks both
fnm exec --using=24 node game/tools/m2-acceptance.mjs --url "$M2_STATIC_URL" --backend webgpu --locks both
fnm exec --using=24 node game/tools/m2-acceptance.mjs --url "$M2_STATIC_URL" --backend webgl --locks both
fnm exec --using=24 npx --no-install tsx game/tools/m2-balance.ts
fnm exec --using=24 npx --no-install tsx game/tools/m2-bench.ts
fnm exec --using=24 node game/tools/m2-evaluate.mjs --dev-url "$M2_DEV_URL" --static-url "$M2_STATIC_URL"
fnm exec --using=24 npm run game:play -- stop
fnm exec --using=24 npm run game:play -- boot "$M2_STATIC_URL?debug=1"
fnm exec --using=24 npm run game:play -- net
fnm exec --using=24 npm run game:budget
fnm exec --using=24 npm run game:play -- stop
PLAY_ACCEPTANCE=1 PLAY_ORIGIN=http://127.0.0.1:5205 fnm exec --using=24 npm run game:test -- tools/play.test.ts
```
