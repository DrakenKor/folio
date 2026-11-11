# T1.7 feedback — round 2 final

All six fixes and both-backend checks are complete. Director review and navigator playtest remain external acceptance gates.

## Presentation

- Radius-sized Creasebacks have overlapping folded plates, triangular ridge scales, dark under-folds and ivory eyes, using the knight's cel finish.
- Numbers last 30 ticks, cap at 16, stack by target/age and resolve screen collisions; confirmed contacts add four small fragments.
- Ochre warnings test terrain depth beneath actors, with dark rims and radial fills advancing with processed windup age.
- Dodge streaks and collapsing, fragmenting, fading deaths reconstruct from state; replacement clears transient contacts.
- Trees and rocks move outside the arena boundary, restoring central framing while keeping combat clear.
- Broad patches travel at 6 m/s through the shared grass, ground and crown wind field.

Approved camera, aim, HUD, cut arc, dart, shortened grass and bloom restraint are preserved. Rendering never writes simulation state.

## Verification

All four acceptance areas pass on WebGPU and forced WebGL2 in development and static builds.
Checks cover confirmed hits, misses, immunity, flash/pause, expiry, both outcomes/restarts, orbit-limit visibility and pointer/projectile aim.
The 7,200-tick fight retains hash `bec54592`; rendering leaves serialized simulation state unchanged.
Additional checks confirm radius bounds, five crowded label layouts, decal depth/order and exact dodge/death restoration.
All 48 camera/boundary sight lines are unobstructed. Console samples contain zero game errors or warnings.

| `play.mjs perf 8` frame intervals | Median | p95 |
| --- | --- | --- |
| WebGPU development | 10.0 ms | 11.8 ms |
| WebGL2 development | 10.0 ms | 11.4 ms |
| WebGPU static | 10.0 ms | 11.7 ms |
| WebGL2 static | 10.0 ms | 11.5 ms |

Apple M4 Pro, Brave Chromium 157, seed 7; 1440 × 900 CSS / 2160 × 1350 buffer.
After 6,000 scripted warmup ticks, the normal clock advances to ticks 6,486–6,491 during sampling. Raw frame samples are retained.

Restore differences: WebGPU 0.24163%; WebGL2 0.24174%. Both have zero differing persistent pixels after excluding cleared contact transients.
Dodge/death transforms, fade values and trail geometry restore exactly.

Commands use `fnm exec --using=24`:

- `npm run game:test`: 325 passed; one existing opt-in browser test skipped.
- `npm run game:build`: pass; existing large-chunk advisory remains.
- `npx --no-install eslint game`: pass.

Local `check.mjs` and `r2-check.mjs` pass on all four backend/build combinations.
Brave, Vite and the static server are stopped; ports 5197 and 9577 are free. Nothing was installed; no outside changes are proposed.

## Capture judgement

Artifacts: `game/.play-out/t17/r2-{webgpu,webgl}/`, including two-column `fight-compare.png` and `wide-compare.png`.

- Fight: clearer forms, numbers and ground warnings; ridge scales and dodge streaks remain subtle at reduced sheet size.
- Cameras: central scenery frames combat again, retaining the T1.9 palette, landmark, depth and reviewed framing.
- Motion-wide: broad soft patches travel across hills with responding crowns; bright parallel ribbons remain absent.
- HUD: approved defeat/victory styling and restart remain readable.

These are implementer judgements against T1.9 and round 1, not independent critic approval.

## Files

- `render/combat/{creaseback.ts,feedback.ts,README.md}` and `look/standin.ts`.
- `render/meadow-view.ts` and `render/post/outline.ts`.
- `render/foliage/trees.ts`, `render/materials/wind.ts` and `render/props/rocks.ts`.
