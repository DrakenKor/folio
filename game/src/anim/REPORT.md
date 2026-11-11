# T1.6 verification

Implemented pure snapshot poses, stable action variants, measured phase mapping,
absolute rig sampling, terminal death, in-place dodge, independent aim, and
simulation-owned gait in the meadow. The preview selects and steps all 12 clips.

The temporary encounter uses the approved Span Cut values and an AI-free target;
the acceptance driver loads `combat.snapshot.json` through `__game.restore`.
No simulation paths, dependencies or assets were changed.

Measurements and the complete marker table are in
[MARKERS.md](../render/characters/MARKERS.md).
Dodge's 0.25-source-unit travel is removed from cloned tracks, preserving the asset.

| Acceptance | WebGPU | Forced WebGL2 |
| --- | --- | --- |
| 1. All 12 sheets, exact contact ages, terminal death, no clipped frames | Pass | Pass |
| 2. Moving/action/hit-stop captures before and immediately after restore | 0% changed pixels | 0% changed pixels |
| 3. Same continuation with 1/4/60 ticks between renders | Identical state and rig | Identical state and rig |
| 4. All preview variants/block; dodge root zero at 13 samples, 3 m simulation travel | Pass | Pass |
| 5. 90°/180° aim, movement facing, rooted attack, body turn, resumed gait | Pass | Pass |
| Mid-turn and terminal-death restore captures | 0% changed pixels | 0% changed pixels |
| Browser warnings/errors, including preview and sheet generation | None | None |

Visual review covered all 24 sheets and integrated movement/attack/death frames.
Contacts, distinct silhouettes, retained gait and independent aim read consistently.
Terrain foot IK and turn-in-place polish remain the existing later milestone scope.

Commands, each prefixed with `fnm exec --using=24`:

| Command | Result |
| --- | --- |
| `npm run game:test` | 296 passed; one existing opt-in browser test skipped |
| `npm run game:build` | Typecheck/build passed; existing engine chunk-size advisory |
| `npx --no-install eslint game` | Passed, no warnings |
| `node game/src/anim/check.mjs webgpu` | All five checks passed |
| `node game/src/anim/check.mjs webgl` | All five checks passed |

The driver calls `play.mjs sheet`, `shot`, `console`, and `perf 8` on CDP 9577,
with Vite 5197. Artifacts, rig/trajectory samples and console/performance reports
are under `game/.play-out/t16/{webgpu,webgl}/`.

Performance: Apple M4 Pro MacBook Pro, 48 GB; isolated Brave, Chromium
157.0.8103.50; seed 7 meadow, 1440×900 CSS, pixel ratio 1.5. Each sample follows
eight seconds of normal-clock warm-up; intervals are frame intervals, not GPU timings.

| Backend | Median | p95 | Sample |
| --- | ---: | ---: | ---: |
| WebGPU | 10.0 ms | 11.8 ms | 8 seconds, 800 intervals |
| WebGL2 | 10.0 ms | 11.1 ms | 8 seconds, 800 intervals |

Files: `characters/{character,sheet,pose,pose.test,markers,aim}.ts`,
`characters/MARKERS.md`, `anim/{main,fixture,preview}.ts`,
`anim/{combat.snapshot.json,check.mjs,REPORT.md}`, `anim.html`,
`render/meadow-view.ts`, and the `sheet` function in `tools/play.mjs`.
