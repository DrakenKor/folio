# M1 simulation contract

Schema **2**, simulation build **`m1-sim-v2`**, fixed **60 Hz**. Shared types live in `core/types.ts`.
T1.1 defines state, defaults, validation and timing arithmetic; T1.3–T1.6 implement the systems and presentation below.
The existing M0 movement/wandering loop remains in place until T1.3; T1.1 does not activate combat or gait integration.

## State and ownership

All continuation data is plain JSON, serialized and hashed, including scenario content and its fixed tuning.
Presentation reads state and transient events; listeners, mixer callbacks and render cadence never determine gameplay.

| Owner | Fields written |
| --- | --- |
| Scenario/content construction (T1.5) | `world.content` skills, enemy definitions and dodge; `arena`; initial actor stats, factions, skill slots and AI definitions. |
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

## Minimal content and runtime records

`world.content` is immutable after scenario construction, ordered by content id and carried in every snapshot/replay checkpoint.
It contains only `SkillDefinition[]`, `EnemyDefinition[]` and `DodgeDefinition`; there is no modifier, support, loot or asset schema.
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
| Death | Start tick, world-tick age and optional despawn age; null despawn age holds the player's terminal pose. |
| Projectile | Stable owner/skill/faction/action-start tick, position/velocity, age/lifetime, radius and captured damage/impact payload. |

Projectile age zero is its launch tick; it sweeps immediately, once per world tick, including that launch tick.
At each later tick increment age first; remove at `age >= lifetimeTicks` before another sweep.
Thus lifetime L permits exactly L sweeps, at ages `[0, L)`; first hostile contact consumes the projectile, including immunity.
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
Death age starts at zero on the lethal tick, advances on later world ticks and removes enemies at the configured duration.
The player remains at the final death pose until scenario restart; death emits once at the live-to-dead transition.

## Aim, facing and command precedence

Command aim is a world-space point; actor `aim` is its latest nonzero direction angle, from +x towards +z.
Sample aim from the tick-entry actor position; null/coincident aim retains the stored direction.
With no action, moving targets body facing toward normalized movement; idle targets body facing toward stored aim.
Turn along the shortest angular difference, at most `BODY_TURN_PER_TICK` (15 degrees); an exact half-turn chooses positive rotation.
Ordinary locomotion travels along that updated body facing, with command magnitude clamped to one; diagonal speed gains are excluded.
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

1. Validate command; set working tick N+1, sample entry pause/positions, advance existing world timers and consume button edges/aim.
2. Process dead-actor expiry; advance unpaused action ages; run live AI in actor id order, producing intent through shared primitives.
3. Select/cancel actions in actor id order; capture directions/cooldowns and enqueue action/dodge notifications.
4. Turn bodies; integrate ordinary locomotion, dodge or knockback; apply arena bounds and deterministic actor circle separation.
5. Finalize gait using ordinary resolved travel; launch projectiles at the first active age, allocating ids in actor order.
6. Advance existing projectile ages, expire them, sweep all remaining projectiles; gather active melee and projectile contacts.
7. Sort contacts by `(travelFraction, targetId, actorId, projectileId)`; melee fraction is zero and absent projectile id is zero.
8. Resolve each contact serially, rechecking source/target life, faction, immunity and melee deduplication before damage.
9. Commit health, deduplication, interruption, knockback, pause and death immediately; invalidate later contacts from killed/interrupted actions.
10. Publish ordered events and completed world tick; snapshot/hash reads only this fully committed state.

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

Restore rejects missing/invalid health, phases, timers, ids, AI references, content and projectile payloads without defaulting.
Schema-one M0 snapshots/replays fail with `Unsupported snapshot format or schema`; mismatched builds fail explicitly.
The hash still uses canonical-envelope FNV-1a; new state and build/schema values deliberately change old fixture hashes.
Only `game/scenarios/m0-smoke.json` has a live expected hash; historical M0 reports retain their recorded values.
Existing test worlds that exercise restore/replay use the current simulation build instead of a free-form `test` label.
The smoke fixture's initial hash changes from `7de31c7b` to `2a5c16ec`; its movement checks are unchanged.
Meadow seed 7 at 3,600 idle ticks changes from `761cec71` to `0e577070`; projecting to the M0 shape reproduces the old hashes.
Headless smoke reaches the target at tick 195 and stops at tick 196, matching M0; no combat or movement behavior changes here.
The CLI adds `--help` to list its existing options, as required by the task acceptance check.

Run `fnm exec --using=24 npm run game:test`, `npm run game:build` and `npx eslint game` with the same Node prefix.
T1.1 verification: 97 tests pass; the existing opt-in browser test is skipped; build/typecheck and game lint pass.
No combat behavior harness is implemented here; T1.2 records its expected failure before T1.3 implementation.
