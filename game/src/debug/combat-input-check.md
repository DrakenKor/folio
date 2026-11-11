# T1.4 input and combat controls

All 36 combat input checks pass with the approved M1 player content on WebGPU and forced WebGL2.

Run from the repository root with Node 24; install nothing:

```sh
fnm exec --using=24 npm run game:dev -- --host 127.0.0.1 --port 5196 --strictPort
fnm exec --using=24 node game/src/debug/combat-input-check.mjs
```

The script drives `game/tools/play.mjs`, defaults to isolated headless Brave on CDP 9576, and stops Brave in `finally`.
Stop Vite afterward. Override `PLAY_ORIGIN`, `PLAY_CDP_PORT`, or `PLAY_HEADLESS` when needed.
Headless mode avoids desktop focus changes clearing pending input between separate CLI calls.
Boot loads `buildScenario('m1-arena', 7)` through the scenario URL parameter.
Snapshots isolate the player by removing enemies; skill slots, content, stats and arena retain their scenario values.
Span Cut, Fold Dart and Dodge use their loaded definitions; tick intent uses DOM input or `cmd`.
The basic view exercises both render backends without requiring unbuilt meadow assets.

## Acceptance results — 2026-11-11

`fnm exec --using=24 node game/src/debug/combat-input-check.mjs`: **36 PASS, 0 FAIL**, exit 0.
WebGPU: **18/18**. Forced WebGL2: **18/18**. Backend identity is asserted explicitly.

| Acceptance item | Passing on both backends |
| --- | --- |
| 1. Consume at N+1 | W, world aim, movement/facing, button bits, configured action ids at age zero, equivalent `cmd` hashes. |
| 2. Brief/held input and interruption | Brief presses consumed once; held Dodge never chains; held attacks repeat at completion; Dodge interrupts only windup/recovery. |
| 3. Equivalent streams and clearing | One-tick `cmd` override, `simulate`, blur/hide/restore clearing, F8 combat replay verification, death/restart controls. |

No simulation contradictions or remaining failures were found; no simulation or input implementation change is needed.

Death fixtures disable live input; explicit recorded commands, F8 and the Restart button remain usable.
Restart removes its overlay and restores the scenario checkpoint; replacement resets the recorder and clears pending input.
Teleport preserves gait phase, clears velocity/knockback/gait speed, and resets recorder/interpolation history.
Browser console checks report zero warnings/errors on both backends.

## Other checks

- `fnm exec --using=24 npm run game:test`: 322 passed; one existing opt-in browser test skipped.
- `fnm exec --using=24 npm run game:build`: typecheck/build pass; existing large-chunk warning remains.
- `fnm exec --using=24 npx --no-install eslint game`: pass, no warnings.

The skipped legacy browser test requires its separate static-server setup; this script supplies the task's browser coverage.
Only this report and `combat-input-check.mjs` changed; no dependencies were added or installed.
Run browser checks after unit tests: budget fixtures create watched HTML and cause Vite reloads.

## Harness verification

Before implementation, the harness recorded two passes and 34 failures from missing debug hooks and pointer operations.
The command, timing, parity and action assertions remain intact.
Two harness defects were corrected: viewport projection needed a frame after CDP resize, and death must preserve explicit command streams.
The contract consumes explicit commands even while dead; only live gameplay input is disabled by the platform.
The jsdom replay test uses Node's Blob because jsdom lacks `Blob.stream()`.

T1.4b replaces placeholder skills with scenario content and derives held-repeat durations from loaded timing (21/24 ticks).
Action-start checks assert the configured `span-cut`, `fold-dart` and `dodge` ids.
Action age advances before Dodge arbitration: the old setup sampled ages 1/7/10, missing phase boundaries.
The corrected check samples Span Cut ages 5/6/8/9: Dodge succeeds at 5/9, is blocked at 6/8, and never buffers.
