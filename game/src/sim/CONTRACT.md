# Simulation contract

Schema **4**, simulation build **`m2-sim-v1`**, fixed **60 Hz**. Shared types live in `core/types.ts`.
The core loop drives movement, combat, AI and scheduled fight waves for headless, replay and browser callers.

## State and ownership

All continuation data is plain JSON, serialized and hashed, including scenario content and its fixed tuning.
Presentation reads state and transient events; listeners, mixer callbacks and render cadence never determine gameplay.

| Owner | Fields written |
| --- | --- |
| Scenario/content construction (T1.5) | `world.scenario`, `world.content` skills, enemy definitions and dodge; `arena`; initial actor stats, factions, skill slots and AI definitions. |
| Store/core | `schema`, `build`, `seed`, `nextId`, sorted actor/projectile tables, `playerId`; removal clears AI targets and owned projectiles. |
| Step/input arbitration (T1.3) | `world.tick`, actor `previousButtons`; reads one validated command per tick, even during impact pause. |
| RNG subsystem | Named `world.rng` streams; every draw is persisted. |
| Aim/locomotion (T1.3) | Actor `aim`, `facing`, `vel`, `pos`, `gait.phase`, `gait.speed`; bounds and circle resolution finalize position. |
| Actions/dodge (T1.3) | `action` kind/id/startTick/ageTicks/direction, launch latch, melee hit ids; slot cooldowns and dodge cooldown. |
| Hit/death resolution (T1.3) | `health`, `knockback`, `impactPauseTicks`, `hitFlashTicks`, `death`; interrupts actions and clears motion on death. |
| AI (T1.5) | `ai` phase/ageTicks/targetId and enemy movement/action intent; uses the same action and hit primitives. |
| Projectile system (T1.3) | Projectile position, velocity, age and lifetime; spawn captures owner/faction/skill and fixed damage/impact payload. |
| Animation/rendering (T1.6–T1.7) | No simulation fields; clips, blends, effects and HUD derive from state. |

Action cancellation/death and collision are explicit final writers over earlier movement/action intent in the same tick.
Hit resolution inserts melee target ids and sets impact counters; action processing otherwise owns those collections/counters.
Death resolution overrides AI to `die`; subsequent death age belongs to the death system, not live AI.

Actors and projectiles share the monotonically increasing `nextId`; each table stays sorted by ascending id.
Projectiles are separate from actors and never enter actor separation, AI acquisition or melee target enumeration.
Health is finite, `0 <= health <= maxHealth`, with positive maximum; exactly zero health requires a death record.
M0 defaults are living one-health neutral actors, no skills/AI/actions, zero gait/timers and an unbounded arena.
The player defaults to faction `player`; explicit scenario factions determine hostility by unequal faction ids.
`world.arena` is `{ center: Vec2; radius: number } | null`, with a finite centre and positive finite radius.
Bounds include actor centres at `distance(pos, center) <= radius`, without subtracting actor radius; null is unbounded.

## Minimal content and runtime records

`world.scenario` is a required `SCENARIO_NAMES` member, set by `buildScenario` and preserved on restore.
Direct `createWorld` construction defaults to `empty`; only `m1-fight` schedules additional fight waves.

`world.content` is immutable after scenario construction, ordered by content id and carried in every snapshot/replay checkpoint.
M1 contains `SkillDefinition[]`, `EnemyDefinition[]` and `DodgeDefinition`; optional `m2` carries versioned build content.
`content/schema.ts` exports detached `.parse(unknown)` schemas for content, actions, folds, graph profiles, item bases, affixes and loot tables.
`createWorld(seed, build?, content?)` validates and copies content before construction; `m1Content()` validates its approved definitions too.
Direct fixture edits are validated on snapshot restore; authored content ids are unique kebab-case, with sorted legacy skill/enemy tables.
Tests can construct neutral definitions directly through this public boundary without registering hidden module state.

| Record | Meaning |
| --- | --- |
| Skill | Stable id, melee/projectile kind, integer phase timing/cooldown, fixed damage, knockback speed/ticks, pause and flash ticks. |
| Melee geometry | Ground-plane range from attacker centre; full arc width in radians around the locked direction. |
| Projectile geometry | Speed in metres/second, circle radius, positive lifetime in world ticks. |
| Enemy | Stable id, initial maximum health/radius, movement speed, acquire/attack ranges, skill id and death duration. |
| Dodge | Phase timing, distance, start-to-start cooldown and half-open immunity ages. `dodge` is a reserved action id. |
| Actor skill slots | `primary` and `secondary` ids or null; their independent remaining cooldowns plus `dodge`. |
| Action | Content id/kind, start tick, processed age, locked angle, sorted unique melee hit ids and projectile launch latch. |
| AI | Enemy definition id, phase, phase age and nullable target id; committed strike direction lives in `action.direction`. |
| Knockback | Remaining non-paused actor ticks and velocity in metres/second; no extra transform or renderer displacement. |
| Death | Start tick, world-tick age and optional despawn age; null holds the terminal pose indefinitely. |
| Projectile | Stable owner/skill/faction/action-start tick, position/velocity, age/lifetime, radius and captured damage/impact payload. |

Projectile age zero is its launch tick; it sweeps immediately, once per world tick, including that launch tick.
At each later tick increment age first; remove at `age >= lifetimeTicks` before another sweep.
Thus lifetime L permits exactly L sweeps, at ages `[0, L)`; first hostile contact consumes the projectile, including immunity.
Fold Dart's nominal 10 m travel is 43 sweeps at 14 m/s (10.033 m); there is no separate travel budget.
Expiry and hits remove it immediately; no hit latch, piercing list or projectile collision body remains afterward.
Owner death/removal removes owned projectiles; a pending or flying attack cannot damage after its owner's death.
Melee hit ids survive target despawn; AI targets must refer to an existing actor or null.
Enemy phases are `idle`, `acquire`, `chase`, `telegraph`, `strike`, `recover`, `die`; actions drive strike phase boundaries.
Telegraph starts the enemy skill's windup and locks direction; losing a live target clears intent and returns to idle.

## Integer phases and tick arithmetic

Given a world at completed tick N, `step(world, command)` consumes the command for tick **N+1** and publishes tick N+1.
An action started by that command has `startTick = N+1` and processes/stores **age zero** on that tick.
At the beginning of each later eligible actor tick, increment age once, then classify it with `actionPhase`.
The state stores the last processed age; never reconstruct it as `world.tick - startTick`, because hit-stop pauses age.

For windup W, active A and recovery R:

| Phase | Processed ages | First absolute tick without pause, start S |
| --- | --- | --- |
| Windup | `[0, W)` | S, when W > 0 |
| Active | `[W, W+A)` | S+W |
| Recovery | `[W+A, W+A+R)` | S+W+A |
| Complete | `W+A+R` | S+W+A+R; clear action before selecting a replacement |

Phase lengths and cancellation offsets are nonnegative integers; A is positive, W/R may be zero.
Snapshots retain only incomplete actions; age exactly W+A+R clears the action on that command tick.
Movement can cancel recovery when `age - (W+A) >= moveCancelTicks`; R disables cancellation before completion.
Changing phase has no event-driven timer; melee damage is active-only, and a projectile launches once at the first active age.
Set the launch latch in state before emitting presentation events; each melee action stores every accepted target id once.
Variant/clip choice is a stable function of action id, actor id and start tick; no mutable mixer selection is required.

Initial engine tuning from the milestone (content workers supply the approved skill definitions):

| Action | W / A / R | Active ages | Recovery starts | Completes |
| --- | --- | --- | --- | --- |
| Melee | 6 / 3 / 12 | 6–8 | 9 | 21 |
| Projectile | 8 / 1 / 15 | 8 | 9 | 24 |
| Dodge | 0 / 10 / 8 | 0–9 | 10 | 18 |
| Enemy strike | 24 / 3 / 24 | 24–26 | 27 | 51 |

Default dodge is 3 m, immunity at ages `[2, 8)`, with a 30-tick start-to-start cooldown and no recovery cancellation.
Skill definitions supply their own recovery cancellation offset; placeholder fixtures use 2/2/3 ticks and neutral ids.
An action starting at S sets cooldown C; decrement it at the beginning of each later world tick, before eligibility.
It becomes ready at S+C; do not decrement a newly assigned cooldown on its starting tick.
Held attacks may start again on the first eligible completion tick; cooldown and phase completion must both permit it.

## Hit-stop and interruption

At tick entry remember whether an actor's `impactPauseTicks > 0`, then decrement its existing pause once.
That remembered flag freezes action age, facing, ordinary locomotion, dodge travel, gait and knockback for the entire tick.
World ticks, command consumption, previous button bits, cooldowns, flash/death timers and projectile flight continue.
Paused actors can still take hits; new pause/flash counters use `max(remaining, incoming)`, without stacking durations.
A hit applying pause H on tick K freezes exactly K+1 through K+H; normal actor processing resumes at K+H+1.
Hit flash F appears on K through K+F-1; decrement pre-existing flash before applying new hits.
Pause-zero hits freeze no subsequent tick; no command is dropped or buffered during pause.
These rules start at two pause ticks and six flash ticks when supplied by content, independently of render frame rate.

Confirmed positive damage interrupts the target's current action, clears its pending melee/launch work and starts bounded knockback.
Replace knockback with the latest hit's direction/speed/ticks in the deterministic resolution order; never add unbounded impulses.
Knockback uses locked attack/projectile travel direction and is clipped by arena bounds/circle resolution.
An immune dodge takes no damage, flash, pause, knockback or interruption; it emits no hit/damage event.
Death takes precedence immediately: health zero, action null, velocity/gait speed zero, knockback null, pause zero and AI `die`.
Dead actors neither act nor collide; remove pending contacts/projectiles from a dead source before they can deal damage.
Death age starts at zero on the lethal tick; set `death.despawnAfterTicks` to the definition's `deathTicks` via `ai.enemyId`, or null without AI.
Age advances on later world ticks; remove an actor at its non-null despawn age, while null holds its terminal pose indefinitely.
The AI-free player remains until scenario restart; death emits once at the live-to-dead transition.

## Aim, facing and command precedence

Command aim is a world-space point; actor `aim` is its latest nonzero direction angle, from +x towards +z.
Sample aim from the tick-entry actor position; null/coincident aim retains the stored direction.
With no action, moving targets body facing toward normalized movement; idle targets body facing toward stored aim.
Turn along the shortest angular difference, at most `BODY_TURN_PER_TICK` (15 degrees); an exact half-turn chooses positive rotation.
Ordinary locomotion travels along that updated body facing, with command magnitude clamped to one; diagonal speed gains are excluded.
Full-length player input uses `GAIT.runSpeed` (2.521 m/s); shorter input scales that speed by its magnitude, with no new state field.
Enemies use the `moveSpeed` of the definition referenced by `ai.enemyId`.
An action captures aim at start; its body turns toward that locked angle at the same maximum rate throughout the action.
Dodge captures movement direction, falling back to body facing; travel uses that direction, regardless of ongoing pointer movement.
Windup and active phases root ordinary locomotion; recovery roots it until movement cancels at the defined offset.
Aim still updates while rooted/paused, but never redirects an existing action; facing itself freezes during impact pause.

Each tick uses the following precedence after phase advancement and cooldown decrement:

1. Death prevents all intent; impact pause or active knockback prevents new actions and ordinary movement.
2. A rising Dodge bit wins if cooldown is zero and the actor is idle or in skill windup/recovery.
3. Dodge cannot interrupt a skill's active phase, another dodge, or impact pause; blocked edges are consumed without buffering.
4. An existing skill/dodge continues unless interrupted; ordinary movement cancels eligible recovery before selecting another action.
5. If idle, held Primary wins over held Secondary; skip unassigned/unready slots and take the first eligible one.
6. With no selected action, ordinary movement runs; otherwise root or apply the selected dodge's active travel.

Persist `previousButtons` after consuming every command, including while dead/paused, so a held Space never chains dodges.
Primary/Secondary are level-triggered; Dodge is edge-triggered. Other defined button bits are reserved and ignored by M1 systems.
Validate finite command vectors and defined, nonnegative button bits before any mutation; normalize movement in the movement system.
Blur/hide/restore clears platform held/pending input; a released zero-button command updates persisted bits on the next tick.
Snapshot restore itself preserves recorded button history for deterministic continuation with an explicit command stream.

## Fixed system and hit resolution order

1. Validate and copy the whole command before mutation; set working tick N+1 and apply operations in array order.
   Sample entry pause/positions, advance existing world timers and consume button edges/aim.
2. Process dead-actor expiry and unpaused action ages; call `processAilments` for due pulses before expiry.
   Wander dummies, then drive live AI in actor id order through shared primitives.
3. Select/cancel actions in actor id order; capture directions/cooldowns and enqueue action/dodge notifications.
4. Turn bodies; integrate ordinary locomotion, dodge or knockback; apply arena bounds and deterministic actor circle separation.
5. Finalize gait using ordinary resolved travel; launch projectiles at the first active age, allocating ids in actor order.
6. Advance existing projectile ages, expire them, sweep all remaining projectiles; gather active melee and projectile contacts.
7. Sort contacts by `(travelFraction, targetId, actorId, projectileId)`; melee fraction is zero and absent projectile id is zero.
8. Resolve each contact serially, rechecking source/target life, faction, immunity and melee deduplication before damage.
9. Commit health, deduplication, interruption, knockback, pause and death immediately; invalidate later contacts from killed/interrupted actions.
10. Call `processProgression` for death rewards and clearing transitions, then append any scheduled M1 fight waves.
11. Publish ordered events and completed world tick; snapshot/hash reads only this fully committed state.

Sweeps use segment-versus-expanded-target-circle on the ground plane, with radius equal to target plus projectile radius.
Use resolved actor positions for the current tick and the projectile's old/new endpoints; sort by earliest fraction in `[0,1]`.
Projectiles consume their first eligible hostile contact; friendly/owner/dead actors are excluded from candidates.
Melee includes a target when its circle overlaps the range sector, with inclusive range/arc boundaries, using deterministic `fmath`.
Paused attackers generate no new melee contacts; their already flying projectiles continue until expiry, contact or owner death.
Accepted hit notifications precede damage, then death for that contact; zero-damage hits may notify/deduplicate but do not interrupt.
`hit`, `damage` and `death` carry stable actor/target ids, tick and a copied world-space impact position.
`hit` also carries skill/action-start/projectile identity; `damage` carries applied amount (clamped to health) and resulting health.
`dodge` carries actor id, null target, tick and start position; no gameplay outcome depends on receiving these transient events.

## Gait and rendering continuity

`GAIT` fixes measured walk/run speeds at 0.561/2.521 m/s and strides at 0.599/2.017 m, from `game/ASSETS.md`.
For resolved ordinary speed v, `k = clamp((v - 0.561) / (2.521 - 0.561), 0, 1)`.
Advance unwrapped cycles by `ordinaryDistance / (0.599 + (2.017 - 0.599) * k)`; speed is ordinaryDistance times 60.
Foot contact offsets are presentation constants; neither asset loading nor three.js enters simulation gait calculations.

Retain the intended ordinary displacement before bounds/collision; measure final displacement projected onto its normalized direction.
Clamp that projected travel to `[0, intendedDistance]`; zero intended travel gives zero gait travel, including idle separation pushes.
Never add correction-vector lengths to stride distance; collision/bounds can reduce a step but cannot create extra steps.
Dodge, knockback and teleport are external displacement: retain gait phase and set ordinary gait speed to zero.
During impact pause retain both phase and last ordinary speed, allowing the frozen pose to be reconstructed after restore.
Teleport preserves phase, clears velocity/knockback and gait speed, replaces interpolation history and resets the recorder.
T1.4 integrates these fields into the existing teleport helper; T1.6 replaces the renderer's accumulated gait map.

Action clip position derives from kind, timing and processed age; locked direction/variant selection survives snapshot restoration.
RenderView's existing previous position/facing poses remain sufficient for M0; no new required Pose fields are introduced here.
T1.6 may derive interpolation from adjacent snapshots, using the same action identity and continuous unwrapped gait cycles.
Never interpolate across a new action, teleport, spawn or world replacement; missing previous samples use current state.
After restore or paused manual stepping, alpha zero samples current state; impact pause freezes action and gait interpolation.
Any additional shared render/clock fields go through the orchestrator; renderer history remains disposable.

## Compatibility and verification

Restore rejects missing/invalid scenario identity, health, phases, timers, ids, AI references, content, circular arenas and projectile payloads without defaulting.
Death despawn duration must match its AI-referenced definition, or be null for an AI-free actor.
Schema-one through schema-three snapshots/replays fail with `Unsupported snapshot format or schema`; mismatched builds fail explicitly.
The hash uses canonical-envelope FNV-1a; schema/build and persisted scenario identity change all previous fixture hashes.
Core `step` and `verifyReplay` handle M0 and M1; the CLI uses the same loop without a separate encounter adapter.

Current golden hashes: M0 smoke `b5af476d`; full 7,200-tick M1 fight `0fbf3195` (121 checkpoints).
The animation combat snapshot also carries schema 4 and `scenario: empty`.
See `ai/README.md` for the fixture hash ledger and behavior comparison against the adapter baseline.
Historical reports retain their recorded values; acceptance replays derive current hashes at runtime.

Run `fnm exec --using=24 npm run game:test`, `npm run game:build` and `npx --no-install eslint game` with the same Node prefix.


## M2 continuation and boundaries

T2.0 defines contracts only. M0/M1 use null characters/encounters, empty M2 tables and no additional RNG draws.
Build content lives in `world.content.m2`: version, actions, folds, graph profiles, item bases, affixes and loot tables.
Actions extend the legacy collision definition with names, immutable tags, typed bases, weapon coefficient and nominal reach.
The legacy `damage` field remains for M1 compatibility; M2 resolves typed bases and weapon coefficients through T2.2.
Sector casts use collision kind `melee` with cast/area tags; tags determine modifier eligibility, independently of collision kind.
M2 action lookup takes priority over legacy skills. Content schemas validate geometry, finite values, legal conversions and nonnegative factors.
Folds declare one handle, tension, compatibility, modifiers, geometry factors, phase deltas and relative projectile angles in degrees.
Graph profiles contain radius/version, six seeded families and six oriented rhombus/hexagon bargains; generation belongs to T2.3.
Affixes declare category/roles, a modifier template, integer tier ranges/unlock ranks and roll-to-value scale; loot tables declare weighted categories.
Content identities and replacement defaults are checked before construction; detailed balance/card counts belong to T2.4 and QA.

| Snapshot field | Contract |
| --- | --- |
| `entity.character` | Null or rank/XP/unspent points, graph profile/seed/version, paid allocations, active shapes, rolled items, equipment, inventory/stash, six-slot loadout and per-action folds. |
| `entity.skillCooldowns` | Remaining ticks by action identity; legacy primary/secondary/dodge cooldowns remain for M1. |
| `world.nextItemId` | Independent monotonically increasing positive item allocator, including owned and ground items. |
| `world.rng.loot` | Persisted named loot stream; required for populated characters, never advanced by previews or rejected operations. |
| `world.encounter` | Null or identity, rest/active/defeat phase, attempt and rewarded actor ids for deduplicated XP/loot. |
| `world.groundDrops` | At most 60 stable rolled items with positions; inventory/stash each hold at most 30. |
| `world.ailments` | Target/source ids, stable ailment id, application/expiry ticks and nullable next pulse tick. Sorted by target id then ailment id; dead/despawned sources retain credit. |
| `world.actionGroups` | Stable group id, actor/start identity and sorted unique hit ids; survives action completion while fan projectiles remain. Sorted by group id. |
| `action.recipe`, `projectile.recipe` | Captured source damage/modifiers, immutable tags, folds, timing and complete footprint; optional only for legacy/dodge records. |
| `action.groupId`, `projectile.groupId` | References the retained fan group; optional for non-fan and legacy records. |

Character item tables are identified by numeric ids; equipment and packed inventory/stash arrays reference each owned item exactly once.
Paid allocations exclude the implicit free root; `points + allocations.length == rank + 3`, rank 1–21, cap XP zero.
The five equipment keys are weapon/offhand/coat/boots/survey-tally; a populated character retains a weapon.
No derived cache is snapshot data. Canonical JSON/FNV-1a includes every continuation field, recipe, hit list, content definition and RNG.
`M2_SCENARIO_NAMES` reserves clearing/balance/stress snapshot identities; construction explicitly throws unsupported pending T2.3/T2.8.

## Operations and results

`Command.operations?: Operation[]` is an ordered list; omission and `[]` both mean no operations.
Copying preserves omission for M1 callers; explicit lists are deeply copied into hooks, events and recorder exports.
Unknown types/fields, missing payloads and malformed values throw before tick advancement or any earlier operation.
Unknown content ids, duplicate loadout/fold choices and other semantic errors reach the owning hook and emit replayable rejection.
Each operation is atomic; a rejection changes no build, item or RNG. Later operations observe earlier accepted edits.

| Operation payload after `type` | Meaning |
| --- | --- |
| `allocate/refund: nodeId` | Coordinate node id; refund includes disconnected paid dependants. |
| `activateShape: shapeId, active` | Explicit activation or deactivation. |
| `equip: itemId`; `unequip: role` | Atomic inventory/equipment swap; weapon cannot be removed. |
| `setLoadout: slots` | Whole six-entry tuple, nullable unique action ids, ordered LMB/RMB/Q/E/R/T. |
| `setFolds: skillId, foldIds` | Whole selected fold list for one action; compatibility/handles/tension are semantic checks. |
| `pickup: itemId` | Stable ground item id, live player within 1.5 m. |
| `stash/discard: itemId, from` | Explicit inventory/stash source; stash transfers to the other store, discard destroys. |
| `beginEncounter/returnToShelter` | No payload; accepted transitions suppress command buttons on that tick. |

`operationAccepted` carries tick, array index, detached operation and reason `ok`.
`operationRejected` carries the same identity plus an `OPERATION_REASONS` code; codes are stable and machine-readable.
Malformed commands throw; unsupported systems return `unsupported`, never pretend acceptance.
`setLoadout/setFolds` route to `combat/build.ts::applyCombatOperation`; all others route to `progression/index.ts::applyProgressionOperation`.
All twelve currently emit unsupported rejection. Rest requirements, heals, item edits, XP/loot and graph changes await their owners.
Build edits and discard require rest; entering rest heals, clears combat transients and releases held input.
Beginning an encounter ends rest and suppresses held attacks on that tick. Six-slot action priority follows Dodge, then tuple order.

`processAilments(world, events)` runs after timer/death-age advancement and before AI/actions.
T2.2 applies contact ailments after direct damage and before death handling inside its combat resolver.
`processProgression(world, events)` runs after contacts and before M1 wave scheduling for death rewards and encounter transitions.
Both return explicit unsupported results today; populated unsupported lifecycle state throws `UnsupportedError` rather than silently simulating.
M1 empty lifecycle state passes through unchanged. Source/target processing and contact ordering retain the M1 rules above.

## Queries and damage numbers

Core exports `inspectStats(world, actorId)`, `previewAction(world, actorId, skillId, targetId)` and `previewBuild(world, edit)`.
They return `QueryResult<T>`: detached `{ok:true,value}` or explicit `{ok:false,reason}`; all currently return `unsupported`.
Build preview uses the player and one Operation, with result, before/after stats/action previews, numeric deltas and cascading refund ids.
Stats expose stable source ids/labels/modifiers, health, movement, reductions and dodge timing.
Action preview exposes the captured recipe, effective conversions, phases/footprint, ailment rules and every damage stage.
It reports both calculated integer hit and health-clamped applied damage, with unrounded final-type contributions.
Queries consume no RNG, mutate no world and depend on no retained cache; cold/warm results agree.

Damage types iterate weight, heat, gale; sources iterate stable instance id. Tags are AND filters; final-type sets are OR filters.
Base plus eligible flats remain nonnegative; convert each original source once, simultaneously, without ancestry scaling.
Legal requests are weight→heat, weight→gale and heat→gale, individually [0,1]; normalize outgoing requests by max(1,total).
For each final type, add boosts into max(0,1+sum), multiply independent nonnegative factors, then apply reduction clamped [0,.75].
Sum unrounded final-type damage and round once with floor(total+.5); applied damage clamps to target health. Zero is permitted.
Player wording is boost/multiplier. No new arithmetic, ailment or recipe resolution is implemented by T2.0.

## Character saves and platform handoff

Core exports pure `exportCharacter(world): CharacterData` and `loadCharacter(data: unknown, content): CharacterLoad`.
The load result is `{world, refunds}` with readable refund messages; both hooks currently throw `UnsupportedError` pending T2.3.
CharacterData holds contentVersion, seed, character, lootRng, nextItemId and reserved empty questFlags/settings.
It excludes encounters, ground drops, projectiles, ailments, clock/presentation state and derived caches; loads create a fresh rested clearing.
Exact continuation uses snapshots, never player saves; all world replacements reset recorder, input and render interpolation.

`SaveEnvelope` adds format `folio.arpg.save`, schema 1, platform generation and application build id.
Fixture-only `LegacySaveEnvelope` schema 0 omits contentVersion/lootRng/nextItemId; T2.5 migrates before validation.
Future/corrupt/invalid saves preserve stored text and disable writes; removed content refunds and replacements belong to the load/migration boundary.
`SaveController` takes injected projection/load callbacks, current-world/replacement callbacks, content/build and optional storage/locks.
It exposes status/export/import/flush/load/reset/takeOver/dispose. Status carries code, writable, generation, copyable text and refunds.
The stub performs zero storage/lock access; status/async methods return unsupported, text export throws unsupported.

T2.5 enforces the 1 MiB entire-envelope limit in both UTF-8 bytes and UTF-16 storage bytes, including import/export validation.
Only `folio.arpg.writer` holders write; every transaction holds never-stolen `folio.arpg.commit`, verifies writer ownership, rereads generation,
requires equality with the last loaded/written generation and writes generation+1. Takeover steals writer, then loads/commits inside commit lock.
Loss/mismatch demotes the old tab; imports commit at stored generation+1. Generation never enters simulation hashes or clocks.
Missing Web Locks means zero localStorage writes, including import/reset/migration/pagehide; text round trips remain available.
Wrap every storage read/write; failures leave prior bytes intact and return typed status plus copyable text.
Autosave follows encounter transitions, 30-second intervals and pagehide; debug scenarios/replays never autosave player progression.
Startup priority is explicit debug state, verified same-session graphics recovery, player save, new character.

`debug/api.ts` preserves string `build` and exposes character methods matching every Operation, stats/damage/preview and save status/export/import/flush/load.
Character methods release input, advance one recorded idle-command tick and explicitly return unsupported pending T2.7 result reporting.
Save mutations delegate to SaveController.
T2.7 supplies live tools/input wiring; T2.8 supplies save/clock/session integration and M2 scenario dispatch.

## T2.0 verification evidence and handoff

M1 fight remains 7,200 ticks, seed 7: 154 damage events, 36 deaths, one dodge, final player health 100.
The new final hash is `0fbf3195`; removing only schema-4 fields and restoring old schema/build reproduces the exact M1 final state.
Complete ordered events retain SHA-256 `28ed005012b3174a767c0511bec7d4bb6fc7d1c9f2687530c5c88cf9c4ae8196`.
The state hash changes solely from schema/build and inert continuation defaults; all 121 fixture/browser checkpoints are migrated.
The smoke scenario and animation snapshot are migrated too; authored commands and historical reports retain their original data.

T2.0 checks constructors, structural validation, ordered unsupported operations, detached previews/recordings and snapshot continuation contracts.
The complete test command has one ownership-bound failure: `game/tools/t18.test.ts:38` hardcodes the schema-3 fight hash.
Proposal for the orchestrator: compare with `expected.finalHash` from the migrated fixture; no assertion is weakened or removed.
T2.0 leaves that unowned file unchanged. QA retains exclusive ownership of the M2 behavioral harness.

Node 24 verification: `npm run game:build` and `npx --no-install eslint game` pass.
`npm run game:test` reports 357 passed, one failed (the unowned hash literal above), one existing browser check skipped.
Excluding only `**/tools/t18.test.ts` passes all 357 remaining tests; the 30 T2.0 contract checks pass.
The skipped check is gated by unset `PLAY_ACCEPTANCE=1`; browser acceptance is outside T2.0's checks.
`npx --no-install tsx game/scenarios/m1-fight.ts` verifies all 121 checkpoints and the replay.
The animation snapshot restores to canonical schema-4 bytes; SaveController probes return unsupported with zero storage access.
