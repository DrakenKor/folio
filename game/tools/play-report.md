# T0.4 browser harness report

Implemented and verified on `game/main`, 2026-11-10, using Node 24.16.0 and
Brave with a temporary profile. No dependency was added or installed.
Brave, Vite, and the static server are stopped; the temporary profile is removed.

## Delivered

| File | Purpose |
| --- | --- |
| `.gitignore` | Ignore the game's Vitest cache under `game/node_modules/`. |
| `game/tools/play.mjs` | Launch, connect, automate, measure, capture, and stop Brave through built-in WebSocket/CDP. |
| `game/scenarios/m0-smoke.json` | Restore the meadow, verify its hash, move 20 m, capture three bookmarks, and measure console, frames, and transfers. |
| `game/scenarios/m0-suspension.json` | Hold W through real tab backgrounding and visible focus loss; verify pause and input release. |
| `game/tools/play-report.md` | Usage, acceptance evidence, commands, and limitations. |

T0.3's two verified commits were integrated unchanged by fast-forward. Their
files and earlier acceptance evidence are in
[`game/src/debug/acceptance-report.md`](../src/debug/acceptance-report.md).

## Usage

Run from the repository root. Each command uses `fnm exec --using=24`.

```sh
fnm exec --using=24 npm run game:play -- boot http://localhost:5176/play/ --scenario meadow-start
fnm exec --using=24 npm run game:play -- run game/scenarios/m0-smoke.json
fnm exec --using=24 npm run game:play -- shot player player.png
fnm exec --using=24 npm run game:play -- console 500
fnm exec --using=24 npm run game:play -- perf 2
fnm exec --using=24 npm run game:play -- net
fnm exec --using=24 npm run game:play -- stop
```

`BRAVE_BIN` overrides the executable. CDP uses loopback port 9555. Commands
share the harness's temporary browser; run them serially. `stop` closes Brave
and removes its profile. A failed command exits 1.

`boot` adds `debug=1`, `fresh=1`, and, unless supplied, `paused=1`. `--snap file`
loads canonical snapshot JSON through `#snap=`. `--out-dir directory` changes
artifact output; the session remains in `game/.play-out/session.json`.

Scripts contain optional `scenario`, `seed`, and `url`, plus a `steps` array.
Each step has `op`: `moveTo` (`x`, `z`), `wait` (`ticks`), `shot` (`bookmark`,
optional `out`), `eval` (`expression`, optional JSON `expect`), `expectHash`
(`hash`), `keyDown`/`keyUp` (`code`), `background` (`seconds`), or `blur`
(optional `ms`, default 250). `console`, `perf`, and `net` also work as steps;
the smoke scenario shows their fields. Movement and waits step the paused
simulation deterministically through `window.__game`.

Focus emulation stays enabled for ordinary automation. Both intentional
suspension checks temporarily disable it: Chromium's focus emulation also
forces visibility, so a real background test requires that exception. `blur`
activates a separate small window and verifies that the game remains visible.

`console.json` captures console output, page exceptions, and browser resource
errors, including startup diagnostics. Vite's transport debug messages are
excluded. A harness-only inline favicon prevents an unrelated missing-icon
request; game source is unchanged. Network cache is disabled before boot;
`net.json` records HTTP transfer bytes through readiness, including headers.

**`sheet` reports unsupported until a character and animation interface exist.**
No contact sheet is produced.

## Acceptance results

| Check | Result |
| --- | --- |
| Dev smoke | PASS, exit 0; initial hash `7de31c7b`, target reached at tick 195, stopped at tick 196. |
| Static `/play/` smoke | PASS, exit 0; identical initial hash and movement result. |
| Three bookmarks | PASS on both servers: `overview`, `player`, and registered `meadow-wide`; PNGs opened and inspected. |
| Console | Empty on both servers; no game warnings, resource errors, or runtime exceptions. |
| Performance | Two-second samples, 240 frames each: dev 8.3 ms median / 9.9 ms P95; static 8.3 / 9.9 ms. |
| Transfer size | Dev 10,995,929 bytes / 26 requests; static 814,304 bytes / 2 requests. |
| T0.3 check 5 | Both servers: hidden for 10 seconds, tick 2 → 2; W released and player stationary after return. |
| T0.3 check 6 | Both servers: visible but unfocused, paused for 250 ms; ten manual ticks proved W released. Final dev paused tick 18; static tick 17. |
| Snapshot boot | `--snap` restored tick 46 and hash `99e68293`; `expectHash` passed. |
| Failure reporting | Deliberately wrong `expectHash` exited 1 with the failing step and actual hash. |
| Budgets | All five reported limits pass; whole static export 60.05 MiB, game JavaScript about 0.21 MiB gzipped. |
| Existing checks | 25 tests pass across six files; game typecheck/build and ESLint pass. |

Artifacts remain local under `game/.play-out/dev-final/` and
`game/.play-out/static-final/`. The default `game/.play-out/net.json` contains
the static measurement for `budget.mjs`.

## Commands and results

Repeated checks are grouped below; every acceptance and operational command is
listed. All commands exited 0 unless a different result is stated.

<details>
<summary>Verification commands and results</summary>

| Command | Result |
| --- | --- |
| `fnm exec --using=24 node --version` | `v24.16.0`. |
| `git status --short --branch` | Began on `game/main`; only the generated Vitest cache was untracked. |
| `BASE=$(git merge-base HEAD origin/main)` | Resolved the PR merge-base in both worktrees. |
| `git diff --stat "$BASE"...HEAD` and `git diff --name-status "$BASE"...HEAD` | Inspected committed changes against the merge-base. |
| `git diff` and `git diff --cached` | No unrelated tracked changes. |
| `git worktree list` | Confirmed both assigned worktrees and branches. |
| `git log --oneline game/main..game/t03-platform-debug` | Two T0.3 commits. |
| `git rebase -S game/main` (T0.3 worktree) | Already up to date; no rewriting needed. |
| `git merge --ff-only game/t03-platform-debug` | Fast-forwarded `9c55a89` to `0de3411`. |
| `git add .gitignore` | Staged only the requested ignore entry. |
| `git commit -S -m "Ignore the game test cache"` | Created `9a08cce`, signature `G`. |
| `git log --format='%h %G? %s' 9c55a89..HEAD` | Every new commit shows `G`. |
| `fnm exec --using=24 npm run game:test` | Twice passed: six files, 25 tests; last 1,000-dummy median tick 0.695 ms, below 2 ms. |
| `fnm exec --using=24 npm run game:build` | Repeated passes; typecheck succeeds; output JavaScript 812.88 kB / 224.18 kB gzip. |
| `fnm exec --using=24 npx eslint game` | Repeated passes, no findings. |
| `fnm exec --using=24 node --check game/tools/play.mjs` | Repeated syntax checks pass. |
| `fnm exec --using=24 npx eslint game/tools/play.mjs` | Pass. |
| `fnm exec --using=24 npx vite --config game/vite.config.mts --port 5176 --strictPort` | Dev server ready on `/play/`; stopped after verification. |
| `fnm exec --using=24 node game/tools/play.mjs boot http://localhost:5176/play/ --scenario meadow-start` | Repeated boot passes, fresh paused meadow at tick 0. |
| `fnm exec --using=24 npm run --silent game:sim -- --scenario meadow-start --seed 7 --ticks 0` | Hash `7de31c7b`, matching both browser smoke runs. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-smoke.json --out-dir game/.play-out/dev` | First exit 1 exposed the missing favicon; final pass after harness-only icon setup. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-suspension.json --out-dir game/.play-out/dev` | First exit 1 on that favicon; one run was disturbed by another browser command; serial rerun passes. |
| `fnm exec --using=24 node game/tools/play.mjs sheet player idle game/.play-out/sheet.png` | Reports `supported:false`, as permitted. |
| `fnm exec --using=24 node game/tools/play.mjs shot overview standalone-overview.png --out-dir game/.play-out/dev` | PNG written. |
| `fnm exec --using=24 node game/tools/play.mjs console 100` | Empty entries. |
| `fnm exec --using=24 node game/tools/play.mjs perf 1` | 120 frames, median 8.3 ms / P95 9.9 ms. |
| `fnm exec --using=24 npm run build` | Static export passes: 113 pages. |
| `python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'` | Selected free port 59057. |
| `python3 -m http.server 59057 --bind 127.0.0.1 -d out` | Static server served `/play/`; stopped after verification. |
| `fnm exec --using=24 node game/tools/play.mjs run game/.play-out/snapshot-export.json > game/.play-out/snapshot-export.log` | Exported the paused snapshot after 17 additional ticks. |
| `fnm exec --using=24 node game/tools/play.mjs boot http://localhost:5176/play/ --snap game/.play-out/restore.snapshot.json` | Restored tick 46 / `99e68293`. |
| `fnm exec --using=24 node game/tools/play.mjs run game/.play-out/snapshot-check.json` | Snapshot hash expectation passes. |
| `fnm exec --using=24 node game/tools/play.mjs boot http://127.0.0.1:59057/play/ --scenario meadow-start` | Repeated static boot passes. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-smoke.json --out-dir game/.play-out/static` | Static smoke passes. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-suspension.json --out-dir game/.play-out/static` | Static suspension checks pass. |
| `fnm exec --using=24 node game/tools/play.mjs perf 1 --out-dir game/.play-out/static` | 120 frames, 8.3 ms median / 9.3 ms P95. |
| `fnm exec --using=24 npm run game:play -- net` | Repeated pass; default `net.json` has `{bytes:814304}` plus URL/request details. |
| `fnm exec --using=24 npm run game:budget` | All reported budgets pass. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-smoke.json --out-dir game/.play-out/static-final` | Final static smoke passes. |
| `fnm exec --using=24 node game/tools/play.mjs run game/.play-out/wrong-hash.json` | Expected exit 1, actual hash `b12c3a8d` versus `wrong`. |
| `fnm exec --using=24 node game/tools/play.mjs stop` | Brave exits and the temporary profile is removed. |
| `fnm exec --using=24 env BRAVE_BIN='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' node game/tools/play.mjs boot http://localhost:5176/play/ --scenario meadow-start` | Fresh launch through the environment override passes. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-smoke.json --out-dir game/.play-out/dev-final` | Final dev smoke passes. |
| `fnm exec --using=24 node game/tools/play.mjs run game/scenarios/m0-suspension.json --out-dir game/.play-out/dev-final` | Final dev suspension checks pass. |
| `git diff --check` and `git show --check --oneline HEAD` | No whitespace errors. |
| `git add game/tools/play.mjs game/scenarios/m0-smoke.json game/scenarios/m0-suspension.json` | Staged the harness and scenarios. |
| `git commit -S -m "Add the Brave game automation harness"` | Created `41b9cd4`, signature `G`. |
| `git fetch origin game/main` | Remote fetched successfully; no conflicting integration changes. |
| `ps -p 34635,37290 -o pid=,command=` | Confirmed the exact Vite and Python processes before stopping them. |
| `kill -INT 34635 37290` | Both servers stopped; Python exited 0, Vite's command runner reported signal termination. |
| `lsof -nP -iTCP:9555 -sTCP:LISTEN -Fp` | Exit 1 with no output after Brave shutdown: no listener. |

</details>

Temporary fixtures were generated with Node's built-in `fs`: the snapshot
export script calls `pause(); step(17); snapshot()`, the snapshot expectation
uses `run.json`'s hash, and the negative probe expects the literal `wrong`.
The final Node probe confirmed ports 5176, 59057, and 9555 were unreachable and
`game/.play-out/session.json` was removed.

Builds retain the existing Vite chunk-size warning and the site's existing
`THREE.Clock` deprecation warning. Neither blocks the build. No changes outside
the requested paths are proposed. T0.3 checks 1–4 and 7 retain their existing
verified report; only checks 5 and 6 were required to be rerun here.
