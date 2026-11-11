# T1.7 feedback — round 1

Implementation and both-backend verification are complete. Independent critic and director review remain pending.

- Combat reads simulation poses, pause, flash, action age, projectiles and death; it never writes gameplay state.
- Confirmed damage produces one number per hit, capped at 16 concurrent numbers with a 42-tick lifetime.
- World replacement clears contact history; persistent flashes, warnings and death poses reconstruct from current state.
- Span Cut draws a thin warm contact arc; Fold Dart draws an ivory wedge, short tail and confirmed-contact fragments.
- Creasebacks retain a low plum silhouette, folded triangular scales, ivory eyes and an ochre committed strike sector.
- The 55° camera follows smoothly at 40° FOV, with 17–22 m distance and −5° to 35° yaw.
- Wheel changes distance; Shift + wheel changes yaw. Bookmarks snap directly; pointer aim intersects the terrain heightfield.
- The translated simulation arena shortens grass and excludes flowers, solid scenery and obstructing foreground crowns.
- The HUD reads health, action/recovery and dodge availability; encounter outcomes expose restart without changing simulation rules.
- Arena exclusion preserves the seeded shapes of every remaining tree, including distant landmark framing.
- Wider gust shoulders and quieter shared sheen retain travelling wind and synchronized crown response.

## Verification

All four acceptance areas pass in dev and static builds on WebGPU and forced WebGL2.
Browser checks cover confirmed hits, misses, immunity, pause, expiry, pointer/dart heading at all orbit limits, both outcomes and restart.
The full 7,200-tick fight retains hash `bec54592`; rendering leaves serialized simulation state unchanged.
Retained tree vertex positions, normals, colours and wind attributes exactly match the approved layout.
Scenery geometry stays outside the arena; 48 boundary/camera sight-line probes found no foreground obstruction.
Both backends retain zero differing persistent pixels after restoring a mid-fight bookmarked snapshot.
Raw before/after differences are 0.23707% WebGPU and 0.23714% WebGL2, from intentionally cleared numbers and fragments.
All browser console samples contain zero errors or warnings.

| Eight-second fight sample | Median | p95 |
| --- | --- | --- |
| WebGPU dev | 10.0 ms | 11.7 ms |
| WebGL2 dev | 10.0 ms | 11.4 ms |
| WebGPU static | 10.0 ms | 11.7 ms |
| WebGL2 static | 10.0 ms | 11.4 ms |

`play.mjs perf 8` measures animation-frame intervals at 1440 × 900 CSS pixels and a 2160 × 1350 drawing buffer.
Samples execute the committed fight commands, one simulation tick per rendered frame, including normal wave gaps.

`fnm exec --using=24 npm run game:test`: 325 passed; one existing opt-in browser test skipped.
`fnm exec --using=24 npm run game:build` and `fnm exec --using=24 npx --no-install eslint game`: pass.
The build retains its existing large-chunk advisory. No dependency, installation or outside-ownership change is needed.

## Capture judgement

Camera and motion sheets preserve the T1.9 palette, ink, landmark and depth; far gusts now read as a gentle sheen.
The fight sheet separates warnings, actors and darts; overlapping pack deaths are its least obvious still-frame cue.
HUD captures make both outcomes and restart clear. Flight and contact share one split panel to fit seven moments into six cells.
Camera, motion, fight and outcome captures use M1; additional meadow-start comparisons retain the T1.9 setup.
These are implementer judgements, not independent critic scores. No rubric gap is declared approved or deferred.

## Files

- `render/combat/{feedback.ts,README.md}` and `ui/hud.{ts,css}`.
- `render/basic/{camera,view}.ts`, `render/meadow.ts` and `render/meadow-view.ts`.
- `render/foliage/{flowers,grass,trees}.ts` and `render/materials/wind.ts`.
- `render/props/{banners,rocks}.ts` and `render/terrain/{heightfield,meadow-material}.ts`.
- `look/standin.ts` and the HUD integration lines in `main.ts`.
