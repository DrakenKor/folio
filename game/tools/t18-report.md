# T1.8 integration evidence

QA evidence is complete; original input checks and the default site build have recorded integration findings.
Changes stay in `game/tools/` and the new browser scenario; gameplay, rendering, UI, dependencies and M0 fixtures are unchanged.

Node 24.16.0; M4 Pro MacBook Pro (Mac16,8), 48 GB, macOS 27.2; isolated headless Brave 157.1.99.56/Chromium 157.0.8103.50.
Vite 5198, static `out/` 8798 and CDP 9578 are stopped; the temporary browser profile/session are removed.

| Check | Dev GPU | Dev GL2 | Static GPU | Static GL2 |
| --- | --- | --- | --- | --- |
| 7,200 ticks; all 121 Node/Brave hashes | Pass | Pass | Pass | Pass |
| Final hash `bec54592` | Pass | Pass | Pass | Pass |
| F8 combat replay export/load | Pass | Pass | Pass | Pass |
| M0 smoke, movement, three bookmarks | Pass | Pass | Pass | Pass |
| M0 background/visible iframe blur | Pass | Pass | Pass | Pass |
| Eight restore states: pose/pixels/Node continuation | 0% changed | 0% changed | 0% changed | 0% changed |
| Twelve animation sheets | Pass | Pass | Pass | Pass |
| Combat blur/background and released inputs | Pass | Pass | Pass | Pass |
| Combat device loss/Reload and released inputs | Pass | Pass | Pass | Pass |
| Final runtime warnings/errors | Zero | Zero | Zero | Zero |
| Original input runner | 17 fail | 17 fail | 17 fail | 17 fail |
| T1.4b runner, paths adapted | 3 fail | 3 fail | 3 fail | 3 fail |
| Current camera/HUD adapter | 18 pass | 18 pass | 18 pass | 18 pass |

Restores cover gait, windup, active, recovery, dodge, hit-stop, projectile flight and death; all 32 pairs match exactly.
Graphics recovery retains tick 166/hash `d37bee89`; the next command is idle, clearing held/pending/queued input.
M0 retains initial `622e8f5e`; no T1.8 schema/hash amendments or behavior changes occurred.

| Performance, seed 7 | Median / p95 | Sample |
| --- | --- | --- |
| WebGPU fight | 16.6 / 19.6 ms | 7,180 intervals; 120.018 seconds |
| Forced WebGL2 fight | 16.7 / 19.5 ms | 7,172 intervals; 120.034 seconds |
| Node stress: 13 actors, up to 16 projectiles | 0.022 / 0.067 ms | 600 ticks after 120 warm-up ticks |
| Node 1,000 dummies | 1.032 / 1.470 ms | 600 ticks; M0 median 0.69 ms |

Fight samples use the normal clock, 1440 × 900 CSS pixels, ratio 1.5, after 600 warm-up ticks.
The existing tick callback queues `cmd`; both runs match all hashes, with capture overhead included in raw intervals.
These are frame intervals, not GPU timings; M0's meadow median was 10.0 ms.
Vite starts in 142 ms; fresh-browser dev readiness is 461 ms; the owned HMR probe updates in 14.6 ms.

| Evaluation command, prefixed with `fnm exec --using=24` | Result |
| --- | --- |
| `npm run game:build` | Pass; typecheck/build 1.85 seconds |
| `npm run game:test` | 326 pass, including 165 T1.2 cases; one opt-in skip |
| `npx --no-install eslint game` | Pass; no diagnostics |
| `npm run build` | Fail; Turbopack font-loader resolution |
| `npm run build -- --webpack` | Pass; 113 pages, playable `/play/` |
| `npm run game:sim -- --scenario m1-fight --seed 7 --ticks 7200 --script game/scenarios/m1-fight-commands.json` | `bec54592` |
| `npm run game:play -- run game/scenarios/m1-fight-browser.json` | Pass on final static export |
| `npm run game:budget` | All five caps pass |
| Site lint/tests | No added failures beyond the recorded baseline |

Budgets: deploy 1.52/500 MiB; export 60.47/900 MiB; gzip JS 0.32/3 MiB; git history 0.90/50 MiB.
First playable transfer is 1,588,262 bytes across six requests, below 30 MiB; final static build identifies `657fd91`.
Fight measurements identify `a026674`, with unchanged game source; standard chunk/site Clock build advisories remain.

| Finding | Proposal |
| --- | --- |
| `745f14e` is missing; original fixture retains an enemy referencing a removed skill | Integrate T1.4b's fixture corrections. |
| T1.4b races camera easing and uses removed `#death-controls` | Port stable bookmark/current HUD observations from `t18-input.mjs`. |
| Default build fails 40 Google-font query-resolution errors | Investigate Turbopack's font loader; documented Webpack fallback already exports successfully. |

The adapter preserves timing, parity, clearing, replay, death and restart expectations; original failures remain recorded separately.
Old-selector console exceptions are harness-induced; corrected input, recovery and fight runs have clean consoles.

Evidence root: `game/.play-out/t18/`; `summary.json` combines final checks without deleting initial failures.

| Path under evidence root | Contents |
| --- | --- |
| `{dev,static}-{webgpu,webgl}/final-acceptance.json` | Final checks, recovery retests and all three input-runner counts |
| Same directories: `fixed/`, `restores/`, `clips/` | Seven exact-tick frames, eight restore pairs, twelve clip sheets |
| `{webgpu,webgl}/` | Raw intervals, seven fight frames, three bookmarks, 4 × 2 fight sheet, 2 × 2 camera sheet |
| `checks/` | Every command log, original/adapted input results, benchmarks, baseline inputs, budget and shutdown proof |
| `static-evaluation/` | Final literal browser command, replay, hashes and current-build transfer |

All ten individual quality frames per backend are 2160 × 1350; scene captures omit DOM overlays.
Normal frames retain actual ticks; WebGL approach renders at 121, while fixed-step approach captures exactly 120.
The GPU clip sheets and both backend montages were opened; independent scoring and navigator approval remain the orchestrator handoff.

Skipped: one legacy opt-in browser test needs separate 8790/9570 setup; the assigned matrix ran separately.
Fourteen existing site WASM comparisons skip because `public/wasm` glue/binary are absent; unrelated builds remain outside scope.
Independent critic, six-line quality scoring and navigator playtest remain the requested handoff; no M1 approval is claimed.

Browser driver: `node --import tsx game/tools/t18-evaluate.mjs <dev|static> <webgpu|webgl> [perf]`.
Input checks: `node game/src/debug/combat-input-check.mjs` (see its `.md`); it freezes the camera at the player bookmark and uses the encounter HUD restart.
All Node commands use Node 24; nothing was installed, pushed, merged or rebased.
