# T0.3 completion report

Implemented the browser clock, input, placeholder view, debug API, snapshot links, replay clipboard flow, and graphics recovery.

Changed only owned source paths; added no dependencies and changed no simulation code.

- `platform/`: clock, input, gzip encoding, reload storage, and nine tests across three test files.
- `debug/`: agent API, toast/recovery UI, acceptance runner, command fixture, and this report.
- `render/basic/`: capsule/grid view, follow camera, and player/overview bookmarks.
- `main.ts`, `index.html`, `vite.config.mts`: browser wiring, minimal controls, and git build identifier.

## Verification

Started the isolated Brave instance and Vite server using the brief's commands:

```sh
~/.claude/scripts/brave-devtools.sh start 9555
fnm exec --using=24 npx vite --config game/vite.config.mts --port 5176 --strictPort
```

Checks 1–7 ran against real Brave through raw CDP, including trusted keyboard events, clipboard permissions, and actual tab changes:

```sh
fnm exec --using=24 node game/src/debug/acceptance.mjs
```

| Check | Result and observed output |
| --- | --- |
| 1. Snapshot fragment | PASS: tick 137, hash `2dc4f57b` before and after full reload with `#snap=`. |
| 2. Node/Brave determinism | PASS: both reached tick 3600, hash `f51fb365`, with scenario `meadow-start`, seed 7. |
| 3. F8 replay round trip | PASS: clipboard replay loaded with `{ok:true}`, ending paused at tick 3600, hash `f51fb365`. |
| 4. Dev reload | PASS: pagehide/sessionStorage preserved tick 3600 and hash `f51fb365`, with no snapshot fragment. |
| 5. Hidden for 10 seconds | PASS: tick 11 before backgrounding, tick 12 while hidden, still tick 12 after 10 seconds. |
| 6. Focus leaves game | PASS: visible iframe had `hidden:false`, `focused:false`, paused at tick 11; W released. |
| 7. Graphics loss | PASS on actual WebGPU and WebGL2: running clock stopped at tick 43; Reload restored hash `44b5fb4b`. |
| 8. Build/tests/lint | PASS: production build succeeded; 25 tests passed across six files; ESLint exited 0 without diagnostics. |

The runner also checked stillness after suspension, released W after both graphics reloads, a successful 20 m agent move,
and the clipboard-denied toast plus replay logged with `console.warn`.

The Node comparison used the same committed command fixture:

```sh
fnm exec --using=24 npm run game:sim -- --scenario meadow-start --seed 7 --ticks 3600 --script game/src/debug/acceptance-script.json
```

```json
{"tick":3600,"hash":"f51fb365","entities":13}
```

Check 8 commands and output excerpts:

```sh
fnm exec --using=24 npm run game:build
fnm exec --using=24 npm run game:test
fnm exec --using=24 npx eslint game
```

```text
✓ built in 266ms
public/play/assets/index-Bj8Oj1Ej.js  812.88 kB │ gzip: 224.18 kB
Test Files  6 passed (6)
Tests       25 passed (25)
ESLint      exit 0, no diagnostics
```

Vite emitted its standard warning for a JavaScript chunk larger than 500 kB before gzip.

## Measurements and handoff

- Brave frame times over 120 frames: median 8.3 ms, P95 9.7 ms.
- Tick times within those frames: median below timer resolution, P95 0.1 ms; 60 tick samples.
- Existing 1,000-dummy simulation benchmark: median 0.669 ms per tick, under its 2 ms target.
- Browser runtime exceptions: zero; one expected warning from the deliberate clipboard refusal.
- Screenshots inspected: `/tmp/t03-platform-player.png`, `/tmp/t03-platform-overview.png`, and `/tmp/t03-loss-{webgpu,webgl}.png`.
- No acceptance checks were skipped. Both the task's Vite server and temporary Brave instance were stopped.
- Signed commits were created on `game/t03-platform-debug`; nothing was pushed, merged, or rebased.
- Vitest generated an untracked `game/node_modules/.vite/` cache; propose ignoring that path outside this worker's ownership.

The API's `build` and replay metadata identify the git revision at Vite startup; simulation hashes retain the shared simulation build identifier.
