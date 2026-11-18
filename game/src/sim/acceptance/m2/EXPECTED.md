# M2 behavioural acceptance baseline

Production baseline: `e1cca451600fa635354b32bfa68b401daa474cc2` (T2.0 merge).
Date: 2026-11-18. Node 24.16.0; isolated Brave; WebGPU; CDP 9580.
No production code changed. The harness is frozen before M2 implementation.

## Commands and results

```sh
fnm exec --using=24 npm run game:test -- src/sim/acceptance/m2 --reporter=json --outputFile=.play-out/m2-node-baseline.json
fnm exec --using=24 npm run game:test -- src/sim/acceptance --exclude 'src/sim/acceptance/m2/**' --reporter=json --outputFile=.play-out/m2-m1-acceptance.json
fnm exec --using=24 npm run game:test -- --exclude 'src/sim/acceptance/m2/**' --reporter=json --outputFile=.play-out/m2-regression.json
fnm exec --using=24 npm run game:dev -- --host 127.0.0.1 --port 5200 --strictPort
PLAY_CDP_PORT=9580 fnm exec --using=24 node game/tools/m2-acceptance.mjs --url http://127.0.0.1:5200/play/ --backend webgpu --locks both
fnm exec --using=24 npm run game:build
fnm exec --using=24 npx --no-install eslint game
```

Vite reported `http://127.0.0.1:5200/play/` (228 ms ready); this is `M2_DEV_URL`.
The Node command exits 1: **154 assertion failures, 10 passes, zero skipped**.
Every numbered file loads; no missing imports, setup failures or unhandled errors remain.
M1 acceptance: **165 passed, zero skipped**. Other existing checks: **358 passed**,
zero failures, one existing `PLAY_ACCEPTANCE=1` browser-gated skip.
Browser command exits 1 after **all 25 cases**, exclusively assertion failures.
Build/typecheck and whole-game ESLint pass; Vite retains its existing chunk-size warning.
The browser owns and removes its temporary profile; the owned Vite server is stopped after verification.

| File | Expected failures | Passes |
| --- | ---: | ---: |
| 01-damage.test.ts | 17 | 6 |
| 02-actions.test.ts | 49 | 0 |
| 03-progression.test.ts | 29 | 0 |
| 04-content.test.ts | 26 | 1 |
| 05-saves.test.ts | 25 | 0 |
| 06-replays.test.ts | 8 | 3 |

The passing cases are six D17 invalid-definition checks, C08 frozen-fixture
invariants, and R05/R06/R09 snapshot/hash contracts. Behaviour remains unimplemented.

## Coverage declared before implementation

Each identifier is a test title; parameterized cases cover every listed entry.

| Spec rule | Test |
| --- | --- |
| Bible A: 120, .40+.25 boosts, 1.20×1.30 factors, projectile exclusion, 309 | D01 |
| Bible B: .40 conversion, final-type boosts, 241.488+146.016, 388 | D02 |
| .80+.60 conversion normalization; effective 4/7, 3/7; 40 heat, 30 gale | D03, D13 |
| Simultaneous original sources; no reconversion/ancestry scaling; 170 | D04 |
| Typed flat on weight-only action; weapon AND heat; cast exclusion | D05 |
| OR final types; AND tags; generic source once per eligible portion | D06 |
| One final rounding, .4+.4=1; sub-half hit zero | D07, D12 |
| Negative additive pool, zero multiplier, reduction clamps, no minimum | D08–D11 |
| Bible closed/open route 127/115; explicit active shape | D14, P03–P05 |
| Bible shortblade 40/32; coefficient before affix flats; cast excludes sword | D15 |
| Stable source arithmetic, detached cold/warm queries, no RNG mutation | D16, D18, R07 |
| Invalid conversion directions/requests, negative factors/flats/bases | D17 |
| Eight actions: delivery, damage, footprints, phases, range/lifetime | A01 (eight), C02 (eight) |
| Six unique slots, Dodge/slot priority, repeat/release, cooldown by identity | A02–A04, B06 |
| Twelve fixed folds: compatibility, gains/prices, tags, cancellation timing | A05 (twelve), A06 (seven), C03 (twelve) |
| Two folds, different handles, three tension; complete recipe/equipment validation | A06, A11 |
| Long+Splay: 15m, recovery 21, six per target; group dedup/immune consumption | A07–A08, R02 |
| Fold order, capped sector, final timing rounding and floors | A09, A21, P20 |
| Captured source recipe, late target defence, future-only ailment effects | A10, A15, R02 |
| M1 rooting, locked aim, sector once, six recovery ticks before movement cancel | A20; retained M1 suites |
| Threshold uses unrounded post-defence >=12; positive/zero/immune; one record refresh | A12 (three), A13 |
| Burden speed .85, 90 ticks; unchanged dodge/knockback; world ticks through hit-stop | A14, A22 |
| Draftbind future damage .90, 90 ticks; captured action unaffected | A15 |
| Emberprint four 30-tick pulses, pulse before expiry, refresh preserves next pulse | A16–A17 |
| Pulse current reduction/final rounding, dodge bypass, no interruption/impact, dead-source credit | A18 |
| Lethal pulse cancels ailments/work, stable target order, XP/loot once | A19, A23 |
| 151 vertices, lattice edges/connectivity, corners removed, six rotations/reflections | P01–P02 |
| Twelve marked perimeters, all vertices, explicit activation, incidental/inactive cycles | P03–P04 |
| Two shapes, root-only overlap, cascading refund/point/deactivation preview | P04–P05 |
| Six seeded sector families, free root, paid values, orientation bargains/penalties | P02, P06, P21, C04 |
| Rest-only build edits, ordered atomic operations, malformed pre-tick rejection | P06–P07, A02 |
| Rank 1/four points, 60*rank cost, carry, cap 21/24, 20 XP once, no death loss | P02, P08–P09 |
| Five implicit bases counted once; 120 base health/2.521 speed; no sword on casts | P10, C05 |
| Health single rounding, movement +30% cap, role-specific recovery/dodge utilities | P10, P20, C06 |
| Exact affix pools/ranges/unlocks, categories, role/tier eligibility, eight-affix budget | P14 (three ranks), P19, C05–C06, C08 |
| 50% drop, equal roles, 50/35/15 rarity, 70/25/5 tiers, integer inclusive rolls | P14, C07 |
| Separate loot RNG, cap 60 suppresses draws, stable ids and seeded reload continuation | P15–P16 |
| Inventory/stash 30 each; full pickup/equip/unequip/stash atomic rejection; weapon required | P11 |
| Fill stores, discard, pick upgrade, equip swap, save/load keeps result | P12, S01, B03 |
| Live in-range pickup, nearest/id tie via F, rest-only discard | P13, B06, B12 |
| Final-kill and whole-trio drops collectible at rest; Start count and next-Start clearing | P17 (two), B12 (two) |
| Clearing trio, rest heal/transient/input reset, Start attack suppression, no attempt healing | P09, P17–P18 |
| Character/save field budget, invalid identities/roles/placements/rolls, no partial import | P19, S01, S05–S06, B09 |
| Canonical schema-1 envelope, populated 65-item projection, fresh rested load | S01–S02, P12, B07 |
| Fixture schema 0: deterministic seed stream, max id+1, content version | S03, N02 |
| Removed nodes/dependants, shapes, folds, skills, bases/legal affixes, both missing-affix categories | S04 (seven) |
| Entire-envelope 1 MiB: UTF-16 and UTF-8 boundaries and first representable excess | S07 (two) |
| Wrapped quota/security/read failures; prior bytes preserved; copyable save | S08, S10, L07 (three) |
| Corrupt/future/wrong-format saves preserve text/state and disable writes | S05 (three), B09 |
| Real initial writer lock, blocked second tab, steal/load/g+1 before enabling | L01, L06 |
| Stale timer/pagehide/manual writes, generation mismatch, repeated takeover/reload | L02–L03, L05 |
| In-flight commit after generation check; takeover serializes and loads A's distinct build | L04 (contract proposal below) |
| Actual 30-second autosave/pagehide; explicit debug worlds never autosave progression | L08, B08 |
| Missing locks before both bootstraps: existing/absent bytes unchanged across every write path | S09 (two), N01 (two), N02 |
| Read-only in-memory play; working text round trip, import/reset/migration/pagehide zero writes | S03, S09, N01–N02 |
| Startup explicit > verified graphics > save > new; stale writer recovery rejected | B07–B08, B10 |
| UI suspension independent from user pause, releases input; confirm one recorded idle tick | B02, B06 |
| Inventory comparison/full state, graph edges/search/refund, fixed fold mouse/keyboard/drag preview | B03–B04 |
| Boost/multiplier wording, numerical tooltip stages equal query; no old categories | B05 |
| Visible save errors, takeover/read-only/import/reset; DOM-inclusive two-size captures | B07, B09, B11, L01, L07, N01 |
| Same build id in public API/dev metadata; selected renderer backend | B01 |
| Schema 4/m2-sim-v1, canonical continuation, every recipe/fan/ailment/RNG field hashed | R05–R06, R09 |
| Each ailment/fan flight snapshot continues through build/equipment/loot and recorder rotation | R01 (three), R02 |
| Ordered copied/rejected build edits, 60-second recorder window, verified hashes | R03–R04, R08 |
| Replacement reset and replay divergence at first bad checkpoint | R08; B07–B08 |
| Frozen builds/scripts, ten seeds, 12 trios/7200 ticks, 36 kills/alive/.25 health in 8 runs | C08–C09; frozen fixtures |
| Full stress fixture, conversions, two folds per action, active ailments, sustained 200/64 | m2-stress.json descriptor; T2.8 executes |
| Performance/transfer/storage/deployment budgets, dev/static × both backends, human UI rubric/reviews | T2.8 evaluation; browser supports both backends and two capture sizes |

## Contract gaps and assumptions

- **Commit race hook missing.** Proposal: a development-only async barrier inside SaveController's real commit lock, after writer/generation checks.
  Expose `__game.save.commitBarrier('arm'|'reached'|'release')`; arm pauses the next commit, reached returns a boolean, release resolves it.
  L04 records this missing contract explicitly. It never substitutes a fake lock or storage transaction.
- **Standalone combat gate has a dependency cycle.** T2.0 throws from progression for any character/encounter, even inert combat fixtures.
  T2.2's public-step suite therefore also needs the T2.3 lifecycle handoff. Proposal: coordinate that handoff; do not mock progression.
- **Authored content has no public entrypoint.** C01–C07/C09 observe content through `buildScenario('m2-clearing')`, currently unsupported.
  T2.4's standalone gate needs public dispatch before its gate, or a reviewed public content entrypoint; no private module discovery is used.
- **Graph topology has no enumeration query.** P01 probes vertices/edges through allocation previews; UI checks real rendered edges/perimeters.
- **Save debug surface omits reset/takeOver.** Browser cases use the visible Reset/Play here controls. No private controller access is used.
- UI assumes accessible English labels for named actions/folds, coordinate buttons, Confirm/Refund, Reach handle, import/reset and save text.
  Search input must expose search semantics; controls and handles must be operable using browser input. These are integration assumptions.
- Public RNG initializes lazily on its first draw; no seed-only initializer is exported. V0 tests require reproducible valid state from seed,
  with different seeds differing; they do not invent an extra draw convention.
- Full-store equip tests interpret overflow as equipping from stash while inventory is full; inventory replacement swaps remain legal.
- Browser combat uses valid public snapshot fixtures with one-health enemies and guaranteed loot, then real attacks and real pickup.
  No damage, lock or contact algorithm is mocked. Only storage errors and API absence are injected.
- Save tests remove Node's actual navigator.locks API for absence cases, restore it afterward, and inject native Node Web Locks for quota.
- Most browser cases currently stop at the missing M2-character precondition. The deeper assertions and captures are frozen but not yet reached.
  Static/WebGL evaluation, performance measurements, balance outcomes and human scores belong to T2.8, not this baseline.

## Frozen balance inputs

`m2-weight-melee.json`: Span Cut + Close/Stanch; 24 paid nodes; rhombi 0/3.
`m2-gale-cast.json`: Rill Fan + Long/Broad; 24 paid nodes; rhombi 1/5.
Only two paid nodes overlap. Graph seed is 7; both use identical five-base,
eight-affix tier-2 gear: weapon weight 8/health 15; offhand health 15;
coat boost 8/health 15; boots movement 5; tally cast boost 15/reach 8.
Semantic descriptors resolve through public schemas without guessing content ids.

`balanceCharacter` constructs the rank-21 projection.
`loadBalanceCharacter` validates it through loadCharacter and installs it in a public m2-balance scenario before stepping.
`balanceCommand` emits movement, aim and buttons only: close/kite, repeat primary,
dodge nearby committed telegraphs. No combat heals, teleports, respecs or resets.
`balanceWaves` returns the frozen seed-specific schedule: trios at 0,600,…,6600,
spawn offsets bounded by .3m; no rest transitions. Each of seeds 1–10 runs 7200 ticks.
The unchanged gate is 36 kills, alive at >=25% health, in at least eight seeds per build.
T2.8 runs these exports; it must not replace the scripts or lower thresholds.

SHA-256 freezes:

| Artifact | SHA-256 |
| --- | --- |
| game/tools/m2-fixtures.ts | `fd6c253dd611a1cc403bc5827d5611680ed47e259142012670760b400408caa9` |
| game/scenarios/m2-weight-melee.json | `4710ec167857ab025268b3d081995b02fc6bd2eaff84e81c36357ff3cdf031b8` |
| game/scenarios/m2-gale-cast.json | `338133e42556bd3065f8c52aeade8c65696443858aae7a39e574b899a1dc042c` |
| game/scenarios/m2-balance.json | `8ff76fa9c98f049dab9bd9acb217180f5db0c4f5ceed7acd6c6c1286e8e9b962` |
| game/scenarios/m2-stress.json | `94380277746e32754446f6e0541eb84fed6c9f94ee5daa4b3e2323ea778b8cad` |

## Every expected Node failure

Codes: Q = unsupported query; A = legacy action lookup has no M2 recipe;
P = unsupported progression lifecycle; L = unsupported ailment lifecycle;
C = unsupported public M2 scenario; E = unsupported character projection/load;
S = SaveController returns unsupported instead of the required typed result.
These are all assertions at the public boundary, including unavailable-step assertions.

| File / case | Baseline |
| --- | --- |
| 01-damage: D01 Bible A additive boosts and independent multipliers = 309 | Q |
| 01-damage: D02 Bible B final-type scaling = 388 | Q |
| 01-damage: D03 oversubscribed .8 + .6 conversions = 40 heat + 30 gale | Q |
| 01-damage: D04 simultaneous original sources never reconvert = 170 | Q |
| 01-damage: D05 typed flat, weapon AND heat, mismatched cast exclusion | Q |
| 01-damage: D06 OR type set AND required tags each instance once | Q |
| 01-damage: D07 .4 weight + .4 heat rounds only final sum = 1 | Q |
| 01-damage: D08 negative additive pool permits zero | Q |
| 01-damage: D09 zero multiplier permits zero | Q |
| 01-damage: D10 reduction below zero clamps to zero | Q |
| 01-damage: D11 reduction above .75 clamps to .75 | Q |
| 01-damage: D12 fractional sub-half hit has no minimum-one rule | Q |
| 01-damage: D13 repeated conversion requests sum before normalization | Q |
| 01-damage: D14 Bible closed shape 127 versus open route 115 | P |
| 01-damage: D15 Bible shortblade 32 or 40; weapon coefficient precedes flats; casts exclude sword | Q |
| 01-damage: D16 stable instance-id arithmetic, detached cold/warm queries and no RNG mutation | Q |
| 01-damage: D18 unknown public query ids return typed rejection without mutation | Q |
| 02-actions: A01 action span-cut uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action fold-dart uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action rill-fan uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action plinth-blow uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action hearth-shard uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action skim-needle uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action sill-rake uses its immutable delivery, phases and public slot | Q |
| 02-actions: A01 action cairn-wake uses its immutable delivery, phases and public slot | Q |
| 02-actions: A02 six unique slots reject duplicates/unknown skills and edits require rest | P |
| 02-actions: A03 Dodge then six-slot priority; held actions repeat; release suppresses repeats | A |
| 02-actions: A04 cooldown follows action identity when reassigned to a different slot | P |
| 02-actions: A05 fold long-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold short-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold stanch-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold splay-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold close-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold broad-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold fine-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold kiln-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold vane-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold draft-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold ballast-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A05 fold hush-pleat fixes gain, price, timing and unchanged tags | Q |
| 02-actions: A06 reject fold-dart ["long-pleat","kiln-pleat"] atomically with tension-limit | P |
| 02-actions: A06 reject fold-dart ["short-pleat","stanch-pleat"] atomically with duplicate-handle | P |
| 02-actions: A06 reject rill-fan ["splay-pleat"] atomically with incompatible-fold | P |
| 02-actions: A06 reject fold-dart ["close-pleat"] atomically with incompatible-fold | P |
| 02-actions: A06 reject rill-fan ["kiln-pleat"] atomically with incompatible-fold | P |
| 02-actions: A06 reject fold-dart ["draft-pleat"] atomically with incompatible-fold | P |
| 02-actions: A06 reject fold-dart ["absent"] atomically with unknown-fold | P |
| 02-actions: A07 Long+Splay golden: 15m, 21 recovery, 6 each; three targets and one target dedup | P |
| 02-actions: A08 fan immune contact consumes target membership through action completion | A |
| 02-actions: A09 fold id order, single final phase rounding, phase/cancel floors, sector cap | P |
| 02-actions: A10 flight snapshot retains recipe and reads target reduction at contact | A |
| 02-actions: A11 equipment edit invalidating unfolded retained folds rejects with preview and no mutation | Q |
| 02-actions: A20 M2 rooting, locked aim, deduped sector and movement cancellation after six recovery ticks | A |
| 02-actions: A21 recovery and cancellation round once after all deltas | Q |
| 02-actions: A12 weight threshold uses unrounded post-defence >=12 and refreshes one record | A |
| 02-actions: A12 heat threshold uses unrounded post-defence >=12 and refreshes one record | A |
| 02-actions: A12 gale threshold uses unrounded post-defence >=12 and refreshes one record | A |
| 02-actions: A13 zero and immune direct hits apply no ailments | A |
| 02-actions: A14 Burden ordinary speed .85, exact 90-tick expiry; dodge distance unchanged | Q |
| 02-actions: A15 Draftbind .90 affects future actions and expires at 90, never rewrites an active recipe | A |
| 02-actions: A16 Emberprint pulses K+30/60/90/120, pulse precedes expiry and no recursion | L |
| 02-actions: A17 refresh preserves next Emberprint pulse under repeated fast hits | A |
| 02-actions: A18 pulses use current heat reduction only, ignore dodge, do not interrupt and credit dead source | L |
| 02-actions: A19 lethal pulse removes ailments and awards XP/loot exactly once | L |
| 02-actions: A22 Burden does not scale knockback and world-tick duration advances through hit-stop | L |
| 02-actions: A23 due pulses process targets in id order; lethal pulse cancels later ailment work and rewards once | L |
| 03-progression: P01 exactly 151 vertices, six rotations/reflections and all lattice edges via allocation previews | Q |
| 03-progression: P02 free root, connectivity, one point per node and stable rejection reasons | P |
| 03-progression: P03 marked rhombus and hexagon orientation 0 require every perimeter node and explicit activation | Q |
| 03-progression: P03 marked rhombus and hexagon orientation 1 require every perimeter node and explicit activation | Q |
| 03-progression: P03 marked rhombus and hexagon orientation 2 require every perimeter node and explicit activation | Q |
| 03-progression: P03 marked rhombus and hexagon orientation 3 require every perimeter node and explicit activation | Q |
| 03-progression: P03 marked rhombus and hexagon orientation 4 require every perimeter node and explicit activation | Q |
| 03-progression: P03 marked rhombus and hexagon orientation 5 require every perimeter node and explicit activation | Q |
| 03-progression: P04 two shapes maximum, root-only overlap, inactive/incidental cycles grant no bargain | P |
| 03-progression: P05 cascading refund previews and applies atomically, refunds every point and breaks shapes | P |
| 03-progression: P06 seeded families stable across reload; base counted once; rest-only build edits | P |
| 03-progression: P07 ordered atomic operations before actions; malformed command cannot partly apply | P |
| 03-progression: P21 graph seed selects a reproducible sector-family permutation; axis ties assign one family only | Q |
| 03-progression: P08 rank costs 60*rank, carries surplus, points only, 20 XP per deduped Creaseback death | A |
| 03-progression: P09 rank 21 caps at 24 paid points, discards XP; player death loses no earned progress | A |
| 03-progression: P10 five starter bases count once, casts exclude weapon, health rounds once and movement caps at 30% | P |
| 03-progression: P11 full stores reject pickup/unequip/stash atomically; weapon remains required | P |
| 03-progression: P12 fill both stores, discard, collect upgrade, swap equip and persist the result | P |
| 03-progression: P13 pickup live within 1.5m; F nearest and id tie-break; discard requires rest | P |
| 03-progression: P14 loot at rank 1 respects role/category/tier unlocks, inclusive ranges, eight-affix cap | A |
| 03-progression: P14 loot at rank 5 respects role/category/tier unlocks, inclusive ranges, eight-affix cap | A |
| 03-progression: P14 loot at rank 10 respects role/category/tier unlocks, inclusive ranges, eight-affix cap | A |
| 03-progression: P15 ground cap 60 suppresses entire loot roll without consuming RNG; non-loot streams independent | A |
| 03-progression: P16 loot RNG and item allocator continue across save/load without repeated-seed rerolls | A |
| 03-progression: P17 final kill rest loot survives, including whole-trio sector kill=false; next Start clears | A |
| 03-progression: P17 final kill rest loot survives, including whole-trio sector kill=true; next Start clears | A |
| 03-progression: P18 entering rest heals/clears combat/releases input; Start suppresses held attacks; no healing in attempt | A |
| 03-progression: P19 invalid character identities, budgets, roles, duplicate placements and tier rolls reject atomically | E |
| 03-progression: P20 health rounds once, movement caps, recovery/cooldown floor one; dodge active/immunity/distance unchanged | P |
| 04-content: C01 eight original actions, twelve original folds, one graph and five starter roles | C |
| 04-content: C02 action span-cut exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action fold-dart exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action rill-fan exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action plinth-blow exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action hearth-shard exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action skim-needle exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action sill-rake exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C02 action cairn-wake exact base, tags, geometry, phases; no resource or extra cooldown | C |
| 04-content: C03 fold long-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold short-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold stanch-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold splay-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold close-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold broad-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold fine-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold kiln-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold vane-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold draft-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold ballast-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C03 fold hush-pleat exact handle/tension/compatibility and fixed gain/price | C |
| 04-content: C04 graph radius seven, exactly six seeded families and all twelve orientation bargains | C |
| 04-content: C05 Shortblade/Shield/Coat/Boots/Tally implicit bases, no mesh or multiplier/conversion affix | C |
| 04-content: C06 bible and additional tier magnitudes, unlocks 1/5/10 and recovery utility routing | C |
| 04-content: C07 loot 50%, equal roles, rarity 50/35/15 and tiers 70/25/5; authored schemas detach | C |
| 04-content: C09 frozen semantic gear resolves to legal public content; controllers emit ordinary commands only | C |
| 05-saves: S01 populated projection round trip: 60 stored items, shapes, folds, gear, RNG/id; fresh rested clearing | E |
| 05-saves: S02 v1 canonical envelope, platform generation excluded from character/simulation state | S |
| 05-saves: S03 fixture v0 migration deterministically restores version, seeded loot RNG and max item id+1 | S |
| 05-saves: S04 removed content nodes refunds/replaces with readable results | E |
| 05-saves: S04 removed content shapes refunds/replaces with readable results | E |
| 05-saves: S04 removed content folds refunds/replaces with readable results | E |
| 05-saves: S04 removed content skills refunds/replaces with readable results | E |
| 05-saves: S04 removed content bases refunds/replaces with readable results | E |
| 05-saves: S04 removed content affixes refunds/replaces with readable results | E |
| 05-saves: S04 removed content utility-affixes refunds/replaces with readable results | E |
| 05-saves: S05 corrupt JSON preserves bytes/state and disables writes | S |
| 05-saves: S05 future schema preserves bytes/state and disables writes | S |
| 05-saves: S05 wrong format preserves bytes/state and disables writes | S |
| 05-saves: S06 invalid identity points rejects import before replacing any state | S |
| 05-saves: S06 invalid identity duplicate-item rejects import before replacing any state | S |
| 05-saves: S06 invalid identity wrong-role rejects import before replacing any state | S |
| 05-saves: S06 invalid identity invalid-rank rejects import before replacing any state | S |
| 05-saves: S06 invalid identity invalid-rng rejects import before replacing any state | S |
| 05-saves: S07 entire-envelope ASCII size limit permits boundary and rejects first representable excess | S |
| 05-saves: S07 entire-envelope UTF-8 size limit permits boundary and rejects first representable excess | S |
| 05-saves: S08 security read failure returns typed status and copyable text | S |
| 05-saves: S08 read read failure returns typed status and copyable text | S |
| 05-saves: S10 quota failure under real Node Web Locks preserves previous bytes and offers valid export | S |
| 05-saves: S09 no Web Locks, save=null: zero writes across load/flush/import/reset/migration; text round trip works | S |
| 05-saves: S09 no Web Locks, save=existing: zero writes across load/flush/import/reset/migration; text round trip works | S |
| 06-replays: R01 snapshot during weight ailment retains expiry/pulse/source; equal continuation through operations and loot | A |
| 06-replays: R01 snapshot during heat ailment retains expiry/pulse/source; equal continuation through operations and loot | A |
| 06-replays: R01 snapshot during gale ailment retains expiry/pulse/source; equal continuation through operations and loot | A |
| 06-replays: R02 multi-dart flight persists captured recipe and group hit list after action completes | A |
| 06-replays: R03 allocation/equipment/loadout/fold edits and rejected semantic edits are copied and replayed in order | P |
| 06-replays: R04 7200 ticks rotate recorder, keep >=60 seconds and all build/loot continuation hashes | P |
| 06-replays: R07 queries leave cold/restored and warm hashes identical, returned values detached | Q |
| 06-replays: R08 world replacement resets recording and replay corruption reports first bad checkpoint | P |

## Every expected browser failure

All cases ran to completion. M = default world lacks an M2 character;
U = save status is unsupported; X = public save export is unsupported.

| Case | Baseline |
| --- | --- |
| B01 build metadata/backend and M2 default clearing | M |
| B02 I/P/K inspect independently suspend clock, release input; confirm records exactly one idle tick | M |
| B03 inventory comparison/full cells/stash and accessible graph edges/search/refund preview | M |
| B04 drawing handles, click/keyboard/drag preview, illegal folds and Confirm show identical recipe/query numbers | M |
| B05 damage tooltip vocabulary/stages equals public preview and explains boost addition/multiplier product | M |
| B06 LMB/RMB/Q/E/R/T priority, W movement, F pickup; editing never attacks behind panel | M |
| B07 real UI text export/import/reset and populated save survive reload | M |
| L01 real same-origin A/B: A generation g, B paused/blocked, Play here loads A and commits g+1 | M |
| L02 delayed autosave/pagehide/manual stale A cannot revert bytes, generation or character | M |
| L03 repeat takeover/reload races three times, newest build and monotonically increasing generation | M |
| L04 proposal: pause A after generation check inside commit; B steal waits; B loads A write before committing | M |
| L05 foreign generation mismatch demotes current writer and preserves latest bytes | M |
| L06 import commits current generation+1, ignoring imported generation; actual writer/commit locks held | M |
| L07 separate quota failure preserves bytes and offers copyable text | M |
| L07 separate security failure preserves bytes and offers copyable text | M |
| L07 separate read failure preserves bytes and offers copyable text | M |
| L08 actual 30-second autosave and pagehide advance generation, debug scenario/replay never autosaves progression | M |
| N01 locks deleted before both bootstraps, absent save: zero storage mutation and text round trip | U |
| N01 locks deleted before both bootstraps, existing save: zero storage mutation and text round trip | X |
| N02 missing locks v0 migration preserves pre-existing bytes, text export migrates only in memory | X |
| B08 startup priority explicit debug > verified recovery > save > new; stale writer recovery rejected | M |
| B10 stale graphics recovery cannot replace a newer takeover build | M |
| B11 real Reset restores a fresh character and later save remains valid | M |
| B12 final kill and whole-trio sector kill keep rest drops collectible; Start displays count and clears remainder | M |
| B09 corruption/future input preserves stored bytes; visible error and no partial import | M |

## Harness audit

The first draft run exposed an invalid QA health-affix pool containing survey tally;
that fixture was corrected before freezing this assertion-only baseline.
Review also corrected a malformed-command assertion to call step directly, and
removed an unjustified one-draw assumption from v0 migration expectations.
Browser reload checks require a new document before observing readiness.
No production changes or skipped cases. Corrections address harness defects;
behavioural requirements and thresholds remain fixed.
