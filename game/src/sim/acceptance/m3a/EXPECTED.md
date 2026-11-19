# M3a acceptance baseline

Game code at `8bafbf549f1e285f440005273a217e2cde3120f5`, 2026-11-19, Node 24.16.0. T3.0 adds QA files only. Preserve the cases, controllers, seed offsets and scoring inputs through T3.7.

| Evaluation | Passed | Expected assertion failures |
| --- | ---: | ---: |
| 01-combat | 12 | 71 |
| 02-cards | 3 | 45 |
| 03-save | 5 | 20 |
| All A-tests | 20 | 136 |
| Balance | 4 | 112 |
| A-browser, WebGPU | 9 | 19 |
| A-browser, WebGL2 | 9 | 19 |

Every A case ran. No setup exceptions, infrastructure failures or skipped A cases. Both browser runs verified the process's headless flag and actual backend before checking the entry character. Both finished with zero gameplay console warnings/errors. Build and lint passed. The existing suite passed 557 tests, including M1/M2. Its opt-in `PLAY_ACCEPTANCE=1` capture test was the single existing skip. Vite reported its existing large-chunk advisory.

## Reproduce

Run from the repository root. Start Vite in its own terminal. Stop that process after both sequential Brave runs. Each browser run owns a temporary profile, cleans it up, and leaves its case results and painted captures in ignored `game/.play-out/m3a-<backend>/`.

```sh
n24() { fnm exec --using=24 "$@"; }
gt() { n24 npm run game:test -- "$@"; }
n24 npm run game:dev -- --host 127.0.0.1 --port 5220 --strictPort

export M3_DEV_URL=http://127.0.0.1:5220/play/
export PLAY_CDP_PORT=9600
gt src/sim/acceptance/m3a
gt src/sim/acceptance/m3a/01-combat
gt src/sim/acceptance/m3a/02-cards
gt src/sim/acceptance/m3a/03-save
n24 npx --no-install tsx game/tools/m3a-balance.ts
n24 node game/tools/m3a-browser.mjs --url "$M3_DEV_URL" --backend webgpu --locks both
n24 node game/tools/m3a-browser.mjs --url "$M3_DEV_URL" --backend webgl --locks both
gt --exclude '**/acceptance/m3a/**'
n24 npm run game:build
n24 npx --no-install eslint game
```

## Simulation coverage and expected reds

IDs resolve to Vitest case names in the numbered file. “All” includes every named parameter of that case. An individual green control records only its observed behavior. For example, M2 can hit a lured target using its old sector geometry but fails the arming, expiry and empty-placement controls.

| 01-combat | Rule exercised | Expected failing variants |
| --- | --- | --- |
| C01–02 | Successful activations build seams once, cap at two, refresh/expire, spend before miss/interruption, hit along the step | All |
| C03 | Held ticks, rooted movement, tap/charge threshold and 45-tick cap | 23, 24, 44, 45 |
| C04–06 | Cap requires up, dodge/direct interrupt/cancel discard unpaid effects, ordinary paused release latches across restore | Both C04 holds, C05 cancelHeld, C06 |
| C07 | Facing, half damage, range, lethal catch, whiff, one answering stamp and its After echo | Front, distant, lethal, whiff, after |
| C08–09 | Empty/parked/recalled/expired eye, recast denial, fresh hit set and anchored hand after movement | All |
| C10 | Tile placement, 18-tick arming, occupied vs lured, expiry and replacement | Occupied, empty, expired, replaced |
| C11–13 | Rooted steerable Fan, four pulses, early release, Dodge/button priority, unavailable spender, replaced tile | All |
| C14–15 | Dead owner loses in-flight attack, tied contacts resolve by source and recheck death | None |
| C16–20 | Clip step/eye/tile to floor, preserve committed warning under root, single frontal catch before rounding, actor/world clocks, dodge on pulse tick | All |
| F01 | Fold Dart preview and contact agree. Broad first target shares three rays. Through counts geometric contacts independently per dart | Splay, Through, both. Combined damage must be 6 |
| F02–05 | After hits the original ground at +18, Hinge retraces outer half, Rim has a quiet centre, Catch prices/delays the primary and hits a new entrant | All |
| F06–11 | Through/Catch first-target payoff, ±18° silhouettes, Hinge step exposure/endpoint, Catch occupancy/expiry, immunity budgets, captured modifiers and living tagged defence | All |
| P01 | Separate Bed/Lift, clean vs prepared, pulse first, immunity, expiry, primary death, secondary cannot reprint | All seven |
| P02 | Separate Fan/Gather, fresh return leg, nearest neighbour with id tie, consume even when alone, immune/expired controls | Prepared, alone |
| P03 | Separate Dart/charged Blow, 24-tick rooted walker, clean/expired walking, immune target retains Burden | Prepared, clean, expired |
| P04 | Immune primary cannot schedule a Catch child | All |
| R01 | Restore during charge, active counter, outbound and returning eye, pending echo, armed tile, channel. Compare actual contacts, suffix events, bytes, hashes and recorded replay | All seven |
| R02–04 | Despawn before delayed hit, fresh entrant, rest before next pack, monotonic effect ids and invalid owner references | All |

| 02-cards | Rule exercised | Expected failing variants |
| --- | --- | --- |
| D01–03 | Profile/build/schema stamps, ten authored cards and recipes, six folds, fresh six-slot order, four 24-weight bases, one starter, 148 HP | D01, D03, every D02 drawing except Span Cut and Fold Dart |
| D04–05 | All six handles/tensions and whitelists, both highlighted two-fold combinations, atomic invalid edits | All |
| D06 | 256 seeded neutral kills with weapon role fixed. Check all four bases, distribution, one item and 20 XP per kill | All |
| D07 | Isolate duplicate handle and total tension using otherwise legal neutral cards | None |
| D08 | Detached path and per-contact conditional preview for Burden, Emberprint and Draftbind | All three |
| I01–04 | Full stores, preserve id/affixes/tier/roll/RNG, preview matches repair, vacated slots first, retain folds and custom slots, tally removal and combat rejection | All |
| I05–06 | Required item and named bind rejection for all ten cards, stale wrong-family/tally starts at each of LMB/RMB/Q/E/R/T have no resource cost | All |
| I07 | Equipping a dropped head and refitting share atomic repair, same-family equipment preserves custom bindings | All |

| 03-save | Rule exercised | Expected failing variants |
| --- | --- | --- |
| S01 | Committed real schema-1 envelope validates against explicit M2, with eight paid nodes, shape, tier-1 rolls, full stores and empty tally | None |
| S02–04 | Preserve owned gear, rank/XP, budget, stores, allocator and loot RNG. Repair family, keep legal Splay and eligible bindings, explain each gated/retired drawing and attached fold once | All |
| S05–06 | Removed base/affix fallback, point and broken-shape receipt, empty hub progress, healed rest and transient-state exclusion | All |
| S07 | Validate structural ownership, point budget, tier/roll ranges, content version and earned marker before replacement | Unknown progress, future content |
| S08 | 65 owned items, maximum rank, point balance and tier-3 gear, native round trip and both byte limits | All |
| S09–10 | Name each of eleven retired M2 folds on a legal historical application. Refund disconnected paid nodes once and preserve complete shape | All eleven folds and S10 |

## Browser coverage and expected reds

Both backends produced identical results. The suite uses CDP input into the served app. The edge probe pauses sampling while releasing and re-pressing. It compares successive commands, discharge tick, victim health, replay hash and replayed event sequence. On M2 the existing Plinth binding lets the physical probe run before the family selector exists.

| Browser IDs | Observation | Expected result per backend |
| --- | --- | --- |
| B01 | Headless flag, backend, painted shelter and starter bindings | Red on bindings |
| B02 | Suppress a real Space key in capture phase, repeat unsuppressed, verify dodge and replay | Green |
| B03–04 | Two DOM edges in one interval, including within charge and three impact-pause ticks | Three reds. M2 samples down/down |
| B05 | Clear held stamp on blur, background tab, inventory panel, dodge or graphics recovery | Four reds for missing cancel-held command. Dodge green |
| B06, B09 | Editor's priced Through/Splay paths and conditional payoff, inventory refits with full migrated stores | Two reds for missing controls |
| B07–08 | Gameplay diagnostics, real F pickup, dead pointer/dodge rejection and defeat UI after paint | Green |
| B10 | Two painted sizes for full charge, whiffed Brace, parked/returned eye and walked-out-of echo | Four reds for missing refits/After |
| S01, S06 | Native same-origin steal while A is inside commit, queued autosave/pagehide, importing old data under contention, B reloads A's latest character, stale A cannot overwrite | Two reds on destination schema |
| S02–04 | Fresh copyable live character after quota/read faults, invalid/future/oversize import preserves bytes and world, player replay/explicit launch isolation and stale recovery | Four greens |
| S05 | Strip Web Locks before bootstrap in both tabs. Import, reset, migration, autosave and pagehide leave original storage bytes and mutation log intact | Two reds. Schema 0 and 1 export schema 1 |
| S07–08 | Inclusive UTF-8 and UTF-16 envelope limits and first excess, boot/import/direct migration receipt equivalence, stored generation and repeat load | S07 six reds until the clearing exists, S08 red on schema |

## Frozen pressure inputs

Rank 5, graph seed 7, eight paid points, zero free points, one complete shape, full 148 HP and starter shield. Both fixtures use exactly five starter roles, weapon-weight-flat +5 and tally cast-gale-flat +3, both tier 1. Hemblade uses rhombus-0 and Span Cut/Open Hem. Verge Reel uses rhombus-1 and Rill Fan/Cast Loop/Gather Line. Both allocation paths are paid through public operations and checked against the original M2 lattice.

Each attempt receives one Creaseback, one Furrow Skater and one Silt Bell. Positions use the frozen seed offsets, at most 0.2 m per axis. A competent policy reads six-tick-old target positions and footprints, keeps its weapon distance, moves clear and dodges. Greedy keeps the targeting/rotation and holds position. Idle sends zero movement/buttons. Actual damage events accumulate even when a final kill heals the character at rest. Victory requires all three deaths. A timeout at 1,800 ticks is a failed attempt.

| Seeds | Per seed | Baseline assertions |
| --- | --- | --- |
| 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | Both builds × competent, greedy and idle | All 60 red. Skater and Bell absent |
| Same ten | Rake stand vs backstep/dodge, rush vs side-step, sampled disc vs side-step, overlapping rush/disc vs greedy | All 40 red. Rake lacks a public committed footprint. Other traces lack cards |
| Per build | ≥8 wins, median 360–840 ticks, median applied loss 20–65%, ≥8 damaged starts, ≥5 greedy deaths, ten idle deaths within 720 ticks of first aggro | All 12 red. Zero measured M3 attempts |
| Per build | Paid graph/tier legality and ordinary controller inputs | All four green |

Each trace restores identical pre-warning bytes for both branches. Step edges in `m3a-pressure.json` are relative to the first commitment and persist until the next listed edge. Escape starts after six ticks. Overlap requires both published shapes to cover the original player position simultaneously. Stand/greedy must take the corresponding warned hits, escape must take zero. The starter-shield bands are 30–42 for rake/rush and 50–68 for the Bell.

## T3.1 contract handoff

- Register `m3a-clearing` and accept neutral public cards through `createWorld`. The proposed `content.m3` shares the M2 graph/item/recipe tables and adds discriminated mechanics, fold whitelist and family ids.
- Preserve held state, release latch, counter and due effects in schema 5. Expose canonical `effects[].id/ownerId` and `cancelHeld` on recorded input.
- Return the repaired `loadout` from build preview. Locked action previews name `requiredItem` and `lockedReason`; expose typed paths, condition, payoff, and clean/prepared per-contact damage. Charged Plinth needs its full-charge comparison.
- Expose clearing warnings from `inspectZone(world)` as a detached query with id, source, start/due ticks and committed sector/lane/disc geometry. The runner's `Warning` type defines exactly which fields it reads.
- Give both migration paths one pure projection and receipt. The proposed native `progress` exposes `lastSafeMarker: 'hem-rest'`, repairs, credited sockets and uncollected drops. Preserve stored generation on ordinary reads.
- A neutral interior-wall mask is needed to prove occluded stitch selection, line-of-effect through a thin wall and wall interception mid-return. C16 already exercises the clearing's circular floor boundary.
- A public fixture for equal-fraction effects with explicit child ordinals is needed to isolate the final ordering tie. C15 covers simultaneous sources and immediate death rechecks.
- The boss walking phase, departure to another map, native earned-post progress and the 60 credited campaign drops require the B-world fixtures. R03 and S08 exercise clearing rest and maximum M3a ownership.

The tests read explicit M2 only when the M3 clearing name is unregistered. Neutral action fixtures exercise the legacy step at the baseline; schema-5 dispatch uses the neutral M3 profile. Field names above are QA's proposed public representations. Record any demonstrated harness defect or approved contract change separately before revising a frozen input.

## SHA-256

Paths are relative to the repository root. The pressure JSON freezes every seed offset, scoring band and paired input edge. The controller and balance digests cover rotation, delay, geometry and scoring.

```text
a4f398ed94f9948377b084e0e14b9c86880c58be2ccd2f9052bad981e8f4c7ee  game/scenarios/m3a-builds.json
d1af9bde68dd7ae8812997699a6f8a96df30196db36ca35d402e4f11dc05b156  game/scenarios/m3a-controller.ts
d5b00c470505d5521d5f07c4ddbfba31e2381ac4927912f30899b36835f8be62  game/scenarios/m3a-pressure.json
953e149426ce65e28287cbbe08afab1c62d404fde4b01f84a8a5317fe4ad346f  game/scenarios/m3a-profile.ts
35381d7f4443cf93545d48160bfed1dee3fc42e78221dbe5b7bbe07aefc0e817  game/scenarios/m3a-save-v1.json
a4bc8cb764ccdc5803a0c39bd7665a561e923ea550f7487f7cfdd708cc03c52e  game/tools/m3a-balance.ts
2e4af7cff24eb8d75b531b18038be89ee72edbb1c1ff046a7c5c2f786067b7b5  game/tools/m3a-browser.mjs
e506b5773871273c70e521be1ffe10189fb30e0c8990b4e21251c4c6c5348484  game/src/sim/acceptance/m3a/01-combat.test.ts
f736fb64ba1fe4d87c4a21cfe59983c89e55a887f2ff39ab94c62ecdeb47e53e  game/src/sim/acceptance/m3a/02-cards.test.ts
324a229a76730b9b1ec5e434732bcea5d9229e6fd3f26d36127ef1a085224123  game/src/sim/acceptance/m3a/03-save.test.ts
e1324280f90ec1784784b7b7d0d316415688598396c0fe80c78db186a3597704  game/src/sim/acceptance/m3a/fixtures.ts
```

## Harness changes

| Date | Change | Demonstrated defect |
| --- | --- | --- |
| 2026-11-19 | S07 resolves `clearing().content` before the `toThrow` assertion. Digest above updated. | T3.1 found that `clearing()` threw inside the asserted lambda, so all six S07 variants passed without reaching `loadCharacter`. They now fail by the clearing assertion until T3.3 supplies it. |
