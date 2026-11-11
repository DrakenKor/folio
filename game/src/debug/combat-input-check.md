# T1.4 input and combat controls

Input plumbing is complete. Full combat checks remain failing until T1.3 implements the existing simulation contract.

Run from the repository root with Node 24; install nothing:

```sh
fnm exec --using=24 npm run game:dev -- --host 127.0.0.1 --port 5196 --strictPort
fnm exec --using=24 node game/src/debug/combat-input-check.mjs
```

The script drives `game/tools/play.mjs`, defaults to isolated headless Brave on CDP 9576, and stops Brave in `finally`.
Stop Vite afterward. Override `PLAY_ORIGIN`, `PLAY_CDP_PORT`, or `PLAY_HEADLESS` when needed.
Headless mode avoids desktop focus changes clearing pending input between separate CLI calls.
Neutral snapshots configure both skills through `restore`; tick intent uses DOM input or `cmd`, never direct state writes.
The basic view exercises both render backends without requiring unbuilt meadow assets.

## Acceptance results — 2026-11-11

`fnm exec --using=24 node game/src/debug/combat-input-check.mjs`: **22 PASS, 14 expected FAIL**, exit 1.
Each backend contributes 11 passes and seven failures; WebGPU and WebGL2 are checked explicitly.

| Acceptance item | Passing now, on both backends | Missing T1.3 behavior |
| --- | --- | --- |
| 1. Consume at N+1 | W, world aim, movement/facing, each button bit, equivalent `cmd` hashes | Primary, secondary and Dodge start no action: three failures per backend. |
| 2. Brief/held input and interruption | Each brief button press reaches exactly one sample | Held Dodge, both held attacks and dodge interruption policy: four failures per backend. |
| 3. Equivalent streams and clearing | One-tick `cmd` override, `simulate`, blur/hide/restore clearing, F8 replay verification | None in the plumbing assertions. Combat replay still awaits actual actions. |

Death fixtures disable live input; explicit recorded commands, F8 and the Restart button remain usable.
Restart removes its overlay and restores the scenario checkpoint; replacement resets the recorder and clears pending input.
Teleport preserves gait phase, clears velocity/knockback/gait speed, and resets recorder/interpolation history.
Browser console checks report zero warnings/errors on both backends.

## Other checks

- `fnm exec --using=24 npm run game:test`: 115 passed; one existing opt-in browser test skipped.
- `fnm exec --using=24 npm run game:build`: typecheck/build pass; existing large-chunk warning remains.
- `fnm exec --using=24 npx --no-install eslint game`: pass, no warnings.

The skipped legacy browser test requires its separate static-server setup; this script supplies the task's browser coverage.
No dependencies, simulation, animation or renderer files changed. T1.3 must activate actions, button history and interruption rules.
Run browser checks after unit tests: budget fixtures create watched HTML and cause Vite reloads.
Proposed outside this task: ignore `game/.play-out/**` in Vite's server watcher.

## Harness verification

Before implementation, the harness recorded two passes and 34 failures from missing debug hooks and pointer operations.
The command, timing, parity and action assertions remain intact.
Two harness defects were corrected: viewport projection needed a frame after CDP resize, and death must preserve explicit command streams.
The contract consumes explicit commands even while dead; only live gameplay input is disabled by the platform.
The jsdom replay test uses Node's Blob because jsdom lacks `Blob.stream()`.
