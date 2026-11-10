# Meadow look spike: rendering report

The meadow keeps WebGPURenderer and TSL on both backends. All three Brave bookmarks pass this worker's six-line look review.

The scene has seeded 256 m terrain, 147,456 grass instances, 32 trees, rocks, pennants and a glowing geometric landmark.

Polish makes the player clearing visible, quiets canopy detail, softens clouds and reduces shadow acne while preserving warm light and cool shade.

Changes since `ec51d20`: `look/main.ts`; `render/foliage/{grass,flowers,trees}.ts`; `render/materials/environment.ts`; `render/meadow.ts`; `render/post/pipeline.ts`; `render/props/{banners,rocks,monolith}.ts`; `render/sky/sky.ts`; `render/terrain/{heightfield,terrain}.ts`; this report.

## Acceptance evidence

| Check | Result and evidence |
| --- | --- |
| WebGPU console | Pass: zero errors, exceptions or warnings across all three bookmarks and their ten-second animation runs. |
| Forced WebGL2 console | Pass: the same three runs report `webgl2`, with zero errors, exceptions or warnings. |
| TSL workarounds | Pass: the accommodations below run inside the spike; no unresolved backend blocker remains. |
| Look rubric | Pass in this worker's review: every score below is at least 4; orchestrator review remains independent. |
| Frozen screenshots | Pass: all six final PNGs were opened and inspected; returning from time 14 to 12 reproduced each PNG exactly. |
| Motion | Pass: time 12/14 captures visibly change grass, crowns, cloth, clouds, projectiles, crystal and motes. |
| Player bending | Pass: moving `__look.debug.meadow.setPlayer(50, 50)` removes the flattened clearing around the stationary hero. |
| Debug controls | Pass: all 16 sliders render; sun, haze and both zero-radius controls update live on WebGL2 without errors. |
| Build and lint | Pass: `fnm exec --using=24 npm run game:build` and `fnm exec --using=24 npx eslint game`. |
| Look entry bundle | Pass: the separate Vite invocation below compiles the dev page, which the normal game entry does not import. |
| Safari | Not run: assigned to the orchestrator. |

The normal build emits its existing chunk-size advisory; type checking, bundling and linting succeed.

## Measurements

Brave 157.0.8103.39 on Apple M4 Pro; 1440 × 900 CSS pixels, device scale factor 1.5, 2160 × 1350 drawing buffer.

Each cell is median / p95 frame time in milliseconds from a separate `__look.perf(10)` call with free-running animation.

| Camera | WebGPU | Forced WebGL2 |
| --- | --- | --- |
| wide | 8.3 / 9.2 | 8.3 / 9.9 |
| player | 8.3 / 9.1 | 8.3 / 9.8 |
| monolith | 8.3 / 9.5 | 8.3 / 9.9 |

All six medians beat the 16.7 ms target. These are animation frame intervals, including display pacing, rather than GPU timestamp measurements.

## Look rubric

Scores apply to the matching WebGPU and WebGL2 captures; visible backend differences do not change the scores.

| Rubric | Wide | Player | Monolith |
| --- | --- | --- | --- |
| Cel light | **4** — Warm crowns transition through broad bands into cool blue shade. | **4** — The red cloak has distinct warm faces above a cool cast shadow. | **4** — Stone and conifers carry broad cool shade beneath warm lit planes. |
| Outlines and silhouettes | **4** — Fine green outlines separate tree clumps and the landmark from the hills. | **4** — Dark red cloak edges and violet enemy edges remain thin against grass. | **4** — Blue ink holds the shaft silhouette without competing with the turquoise lattice. |
| Atmospheric depth | **4** — Three hill layers recede into blue beneath a gradient sky and softened clouds. | **4** — Cool canopy shade and subtle haze preserve depth in the tight ground view. | **4** — Soft clouds and blue mountains frame the darker foreground. |
| Motion | **4** — Time 12/14 captures show grass gusts, moving crowns and drifting cloud edges. | **4** — The banner, scarf and grass change shape while the fighting space stays readable. | **4** — The pennant bends, nearby trees sway and floating motes rise between captures. |
| Selective bloom | **4** — The turquoise landmark glows while sunlit fields and clouds retain their edges. | **4** — Amber projectiles, the staff tip and pink eyes glow without bleaching the grass. | **4** — Bloom hugs the lattice, crystal and motes while stone keeps its dark faces. |
| Readability | **4** — The red hero, violet enemy and bright landmark remain locatable along the warm path. | **4** — Short pale grass exposes the hero's feet, separating the violet enemy and amber projectile clearly. | **4** — The dark shaft and open path separate from grass; combat separation is established in the player view. |

Atmosphere is clearest in wide and monolith; the player bookmark faces the ground. Figures remain deliberate look-only stand-ins for T0.6.

## TSL accommodations

- Stock toon lighting lacks the shared soft-band controls: `CelLightingModel` bands the key and shadow together over hemisphere fill.
- Stock toon outlines share one colour and omit deformation: `CelOutlinePassNode` preserves each material's colour, position node and hull normals.
- Vertex texture sampling needs explicit LOD: grass, flowers and wind use `.level(float(0))` for portable vertex sampling.
- Vertex-derived fragment data uses explicit `varyingProperty` assignments, keeping instance indices and blade calculations in the vertex stage.
- Reversed or equal `smoothstep` edges are avoided in GPU code: ascending ramps use `oneMinus()`, and zero interaction radii explicitly disable masks.
- Default noisy PCF fringes become conspicuous after banding: a fixed 3 × 3 comparison filter and tuned bias keep shadows smoother.
- Crown self-shadowing adds acne to bent lighting normals: crowns cast shadows, while their broad shape normals supply their own shade.
- Whole-image bloom would bleach grass: a separate MRT `glow` attachment admits emissives and the cloud-masked sun disk only.
- Incomplete node typings need local structural casts for lighting inputs, colour uniforms, shadow references and comparison results; toon flat shading is declared locally.

No limitation pushed this scene towards WebGLRenderer with GLSL. Both backends preserve the same art direction and meet the timing target.

## Captures and reproduction

All paths are relative to the repository root; files are local, ignored verification artifacts.

| Camera | WebGPU, seed 7, time 12 | WebGL2, seed 7, time 12 |
| --- | --- | --- |
| wide | `game/.play-out/t05/webgpu-wide.png` | `game/.play-out/t05/webgl-wide.png` |
| player | `game/.play-out/t05/webgpu-player.png` | `game/.play-out/t05/webgl-player.png` |
| monolith | `game/.play-out/t05/webgpu-monolith.png` | `game/.play-out/t05/webgl-monolith.png` |

Matching `*-motion.png` files show time 14. `player-unbent.png` shows the player uniform moved away; `webgl-zero-radii.png` shows disabled interactions.

`webgpu-*-perf.json` and `webgl2-*-perf.json` hold measurements; matching `*-console.json` files contain empty event arrays.

The local raw-CDP driver subscribes before navigation, sets viewport metrics, waits for readiness and captures all warnings, errors and exceptions.

```sh
fnm exec --using=24 npx vite --config game/vite.config.mts --port 5174 --strictPort
~/.codex/bin/brave-devtools --port 9333 start 'http://localhost:5174/play/look.html'

for look_backend in webgpu webgl; do
  for look_cam in wide player monolith; do
    fnm exec --using=24 node game/.play-out/t05/cdp.mjs perf \
      "http://localhost:5174/play/look.html?backend=$look_backend&cam=$look_cam&t=12" \
      "game/.play-out/t05/$look_backend-$look_cam.png"
  done
done

fnm exec --using=24 node --input-type=module -e 'import { build } from "vite"; await build({ configFile: "game/vite.config.mts", build: { write: false, rolldownOptions: { input: "game/look.html" } } })'
```

`__look.debug` exposes meadow uniforms, post settings, camera, renderer and `setTime(seconds | null)` for live inspection.

No dependency or change outside the owned paths is required. Servers and the isolated Brave instance are stopped after verification.
