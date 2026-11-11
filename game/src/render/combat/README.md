# T1.7 feedback — round 3

The four focused changes and both-backend verification are complete. Director review and navigator playtest remain external acceptance gates.

- Creasebacks use two broad tapered folds, a larger head, pointed feet and tail, within their 0.45 m radius.
- Default follow distance is 14 m; zoom stays within 14–19 m and yaw within −5°–25°, retaining 55° pitch.
- Full ochre footprints and pale gold rims remain grounded; six-tick flashes brighten sharply, then soften before clearing.
- Smaller numbers follow targets above their heads, retain collision-aware stacking and reserve clear space around the knight's helmet.
- Broad gust patches travel at 8 m/s through ground, blades and crowns, retaining the existing peak sheen and shader sample count.

Dodge trails, folding deaths, scenery, HUD, bookmarks and simulation behavior are preserved.

All four acceptance areas pass in development and static builds on WebGPU and forced WebGL2.
The existing browser checks cover confirmed hits, misses, immunity, pause/flash, bounded numbers, HUD outcomes/restart, aim and visibility at every orbit limit.
Additional checks retain radius bounds, crowded label separation, grounded decals and exact dodge/death restoration.
Each backend/build combination passes 18 acceptance checks and 11 continuity checks, with empty console samples.
The full fight retains hash `bec54592`; drawing never changes serialized state.

| `play.mjs perf 8` frame intervals | Median | p95 |
| --- | --- | --- |
| WebGPU development | 10.0 ms | 11.6 ms |
| WebGL2 development | 10.0 ms | 11.4 ms |
| WebGPU static | 10.0 ms | 11.8 ms |
| WebGL2 static | 10.0 ms | 11.2 ms |

Apple M4 Pro, isolated Brave, 1440 × 900 CSS pixels, ratio 1.5; normal-clock fight samples start at tick 6000.
Restore differences are 0.14784% WebGPU and 0.14907% WebGL2, entirely cleared contact transients; persistent pixels match exactly.

Using `fnm exec --using=24`: `npm run game:test` passes 325 tests with one existing opt-in skip; `npm run game:build` and `npx --no-install eslint game` pass.
The build retains its existing chunk-size advisory. Nothing was installed; no outside-path changes are proposed.
Brave, Vite and preview are stopped; ports 5197 and 9577 are free.

Captures: `game/.play-out/t17/r3-{webgpu,webgl}/`, including all requested sheets and two-column round 2/3 fight and wide comparisons.

- Fight: broader unified creatures, visible warnings and decisive contact; head and tail details remain subtle in thumbnails.
- Cameras: closer default framing improves combat clarity; landmark, palette, atmospheric depth and edge scenery retain the T1.9 floor.
- Motion-wide: broad soft patches visibly shift across hills; wind remains the quietest cue, without bright parallel ribbons.
- HUD: approved defeat/victory styling and restart remain clear.

These are implementer judgements, not independent critic approval.

Files: `render/basic/camera.ts`, `render/meadow-view.ts`, `render/materials/wind.ts` and `render/combat/{creaseback.ts,feedback.ts,README.md}`.
