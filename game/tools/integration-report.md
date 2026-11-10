# T0.8 integration spike

Implemented and checked on `game/spike-integration`, from `58cd287`.
Implementation commit: `0b43e6e` (SSH signature verified as `G`).
This throwaway branch must never be merged; M5 implements the permanent integration.

## Built

- Added Game first, a stage iframe, short controls notes, and the existing shell's first-frame readiness connection.
- The game posts `ready` once after drawing; the iframe checks message origin and source before revealing the stage.
- Set `pausable={false}` and `allow="fullscreen; clipboard-write"`; added `PLAY_CDP_PORT`, retaining the harness's default port.

Files changed: `src/lib/demos.ts`, `src/app/(demos)/game-demo/page.tsx`,
`src/components/demo/game/{Game.tsx,game.css}`, `game/src/main.ts`,
`game/tools/play.mjs`, and this report. No shell changes or dependencies.

## Verification

| Command | Result |
| --- | --- |
| `fnm exec --using=24 npm run game:build` | Pass: game type check and production build |
| `fnm exec --using=24 npm run build` | Pass: 114 static pages; game exported into `out/play/` |
| `fnm exec --using=24 npx eslint game 'src/app/(demos)/game-demo/page.tsx' src/components/demo/game src/lib/demos.ts` | Pass: no findings |
| `PLAY_CDP_PORT=9666 fnm exec --using=24 npm run game:play -- boot http://127.0.0.1:8766/play/ --out-dir game/.play-out/t08` | Pass: isolated Brave boots the static game on 9666 |
| `python3 -m http.server 8766 --bind 127.0.0.1 --directory out` | Served the exported site for the browser checks |
| `fnm exec --using=24 node game/.play-out/t08/check.mjs` | Pass: checks below; evidence in `game/.play-out/t08/checks.json` |

| Acceptance check | Result |
| --- | --- |
| 1. Home order and text | Pass: Game first; all seven other entries match the saved baseline, including aliases |
| 2. Route and drawing | Pass through the home link: WebGPU draws; one `ready`; threshold opacity becomes 0 |
| 3. Focused H, Space, [, ] | Pass: trusted events reach the iframe; parent receives none; chrome, route, pause button and scroll remain unchanged |
| 4. Return and title transition | Pass: iframe detaches; console stays empty; both native transitions finish with `demo-title-game` animations |
| 5. Screenshots viewed | Pass: inspected home and game captures at 1200 px width |

The browser script uses raw CDP and remains a local, ignored acceptance artifact.
The laptop displays were asleep; CDP focus emulation enabled frames and native transitions.
This verifies iframe key routing, not physical window-focus or suspension behavior.

Measurements: 1200×900 viewport; iframe 1185×900 after the page scrollbar;
one readiness message about 43 ms after a warm route transition began;
zero console entries. Game JavaScript: 812.97 kB raw, 224.23 kB gzip.
These are BasicView measurements, without the parallel meadow and character changes.

## M5 findings

- Implement the final M1 title, slug and first registry entry; retain iframe permissions and `pausable={false}`.
- Reuse the shell's existing `setReady`; subscribe before loading the iframe, validate origin/source, and notify after drawing.
- Resolve extensionless HTML before asset directories: Python redirects `/game-demo` to a directory listing, although client navigation works.
- Keep controls clear of the shell's overlaid bar and Notes link; visitors currently click the game to focus it.
- Add the planned asset-fetch, game-build and budget CI steps; select touch behavior and capability fallback before release.
- Update the shell documentation's fixed seven-demo counts when adding the permanent eighth entry.

## Artifacts and limits

Viewed screenshots, relative to this worktree:

- `game/.play-out/t08/home-1200.png` — 1200×1332, full home list.
- `game/.play-out/t08/game-1200.png` — 1200×900, drawing inside the shell.
- `game/.play-out/t08/home-return-1200.png` — return navigation capture.

No Safari, touch, WebGL fallback, gameplay, or full folio-suite checks were needed for this integration-only spike.
The required builds and targeted lint passed; existing bundle-size and THREE.Clock deprecation warnings remain.
Both temporary Brave instances and the static server were stopped; their temporary profiles were removed.
