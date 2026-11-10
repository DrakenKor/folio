# Meadow and knight integration

Integrated T0.5 and T0.6 into `game/main`; every rebased and new commit verifies `G`.
`a5cee3b` first adds `PLAY_CDP_PORT` (default 9555); `f79d5cd` connects the simulation; `bd6fa82` records measurement dimensions.

MeadowView reads simulation frames, samples terrain height, animates the knight, places purple dummies, and moves grass trample with the player.
Gait integrates simulation distance at every tick, including manual stepping; actions, idle and environmental motion use simulation time.
Simulation origin maps to the seeded player clearing; camera input converts back to simulation coordinates.
The three meadow bookmarks retain the look page's framing; `meadow-player` follows the current player, and `?view=basic` retains capsules.

| Files touched in integration | Purpose |
| --- | --- |
| `game/src/main.ts`, `game/src/render/meadow-view.ts` | Default meadow view, tick hooks and debug sheet interface. |
| `game/src/render/basic/camera.ts` | Terrain height, follow framing and bookmark field of view. |
| `game/src/render/characters/sheet.ts`, `game/tools/play.mjs` | Knight contact sheets, configurable CDP port and 1440 × 900 measurement viewport. |
| `game/src/look/standin.ts`, `game/src/render/post/pipeline.ts` | Reuse the purple enemy and release post-processing targets. |
| `game/scenarios/m0-smoke.json`, this report | Three meadow captures and integration evidence. |

All Node commands below use `fnm exec --using=24`; no dependency or software was installed.
Vite used 5176, the static server used 8765, and isolated Brave used CDP 9555.

| Acceptance | Result and command |
| --- | --- |
| Dev and static smoke, both backends | PASS: `node game/tools/play.mjs run game/scenarios/m0-smoke.json`; hash `7de31c7b`, arrival tick 195, empty consoles. |
| Two snapshot restores | PASS on all four server/backend combinations: tick 24, zero differing pixels out of 2,916,000. |
| Knight contact sheets | PASS: `node game/tools/play.mjs sheet player <idle\|walk\|run> <out.png>`; all sheets opened, no sustained skating visible. |
| Browser WASD and facing | PASS: `keyDown`/`keyUp` scripts show movement and release to idle; mouse aim gives facing −1.919862 and matching rotation 3.490659. |
| Simulation suite | PASS: `npm run game:test`, 25 tests; 1,000-dummy median tick 0.628 ms. |
| Game build and lint | PASS: `npm run game:build` and `npx eslint game`. |
| Static site export | PASS: `npm run build`, 113 pages. |
| Budgets | PASS: `node game/tools/play.mjs net`, then `npm run game:budget`; every cap passes. |
| Basic view | PASS: boot with `?view=basic`, capture `player`; empty console. |

The local driver `game/.play-out/t056/verify.mjs <dev|static> <webgpu|webgl2>` runs smoke, restores, keyboard captures and `play perf 10`.
It decodes PNGs in page canvases and counts any RGBA difference; raw CDP also checks terrain placement, facing and trample.
`game/.play-out/t056/gait.mjs` checks three speeds over 192 ticks each; maximum cadence error is below 1e-15 cycles per tick.
The walk toe's contiguous contact span is 1.36 cm; the 60 Hz run probe has insufficient consecutive near-minimum samples for a useful span.

Brave 157 on Apple M4 Pro, 1440 × 900 CSS pixels, ratio 1.5, 2160 × 1350 drawing buffer; ten-second follow-camera samples:

| Server | WebGPU median / p95 | WebGL2 median / p95 |
| --- | --- | --- |
| Dev | 8.3 / 9.9 ms | 8.3 / 9.6 ms |
| Static | 8.3 / 9.8 ms | 8.3 / 9.6 ms |

These are animation-frame intervals, including display pacing, rather than GPU timestamps.
Static readiness transfers 1,506,120 bytes across five requests; deploy files total 1.44 MiB, gzip JavaScript 0.29 MiB, whole export 60.71 MiB.

Every PNG was opened. Evidence paths, relative to the repository root:

- `game/.play-out/t056/{dev,static}-{webgpu,webgl2}/{wide,player,monolith}.png`: three bookmarks at tick 720, seed 7.
- The same directories contain `restore-a.png`, `restore-b.png`, `wasd-w.png`, `wasd-d.png`, and `wasd-idle.png`.
- Their `smoke/` directories contain `smoke-player.png`, `smoke-monolith.png`, and `smoke-meadow-wide.png` after the 20 m move.
- `game/.play-out/t056/sheets/{idle,walk,run,static-run}.png`: twelve samples per sheet, quarter-metre contact grid.
- `game/.play-out/t056/{aim-facing,basic}.png`: pointer-facing and capsule-view checks.

Matching `acceptance.json`, `perf.json`, `console.json`, `net.json`, movement scripts and moving snapshots retain the measurements locally.
Look review scores apply to both backends at all three bookmarks:

| Rubric | Score / 5 | Evidence |
| --- | --- | --- |
| Cel light | 4 | Warm tree crowns, cool shade and distinct helmet planes. |
| Outlines and silhouettes | 4 | Tinted tree edges; readable helmet, sword and red cape. |
| Atmospheric depth | 4 | Layered blue hills, gradient sky and softened clouds. |
| Motion | 4 | Tick-driven grass, crowns, pennants, motes and character clips. |
| Selective bloom | 4 | Turquoise landmark and pink eyes glow; ground retains detail. |
| Readability | 4 | Pale armour and violet enemies separate around the shortened player clearing. |

Limitation and proposed shared-state change: snapshots contain no accumulated gait phase.
Restores therefore use a reproducible tick-based cycle anchor; two restores match, but the pre-restore moving pose can change.
Persisting phase in the shared simulation/snapshot contract would preserve that continuity; those owned types were left unchanged.
M0's 6 m/s keyboard speed selects run; facing follows pointer aim, as the simulation specifies. Terrain foot IK remains later work.
Safari and navigator art approval remain orchestrator checks. Existing Vite chunk-size and site `THREE.Clock` advisories remain non-blocking.
Brave and both servers are stopped; ports 5176, 8765 and 9555 have no listeners, and the temporary profile is removed.
