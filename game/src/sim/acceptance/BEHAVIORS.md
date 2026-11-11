# M1 behavioral acceptance

Written before the tests; each numbered line is one behavior, with its `CONTRACT.md` rule in parentheses.
Tests observe public world data, `step`, snapshots, hashes, `Recorder` and `verifyReplay`; they import no systems or combat internals.

## 1. Movement, aim and dodge — 11 behaviors

1. Full cardinal/diagonal commands resolve at `GAIT.runSpeed` (2.521 m/s); body turning is bounded (Aim, facing and command precedence).
2. Movement controls body direction independently of pointer aim; null/coincident aim retains direction (Aim, facing and command precedence).
3. Actions lock their initial aim while later pointer input updates stored aim (Aim, facing and command precedence).
4. Dodge covers exactly its configured distance, along movement or fallback facing (Integer phases; Aim, facing and command precedence).
5. Dodge immunity includes its first age and excludes its ending age, checking adjacent ticks (Hit-stop and interruption).
6. Dodge cooldown becomes eligible exactly at start plus cooldown, checking adjacent ticks (Integer phases and tick arithmetic).
7. A held dodge press never repeats; release followed by a fresh eligible press starts another (Aim, facing and command precedence).
8. Dodge interrupts windup/recovery, but blocked active/pause edges are consumed without buffering (Aim, facing and command precedence).
9. Windup/active root movement; recovery permits cancellation exactly at its offset (Integer phases; Aim, facing and command precedence).
10. Dodge wins input arbitration; held attacks repeat and Primary precedes eligible Secondary (Aim, facing and command precedence).
11. Locomotion and dodge stop at the inclusive circular actor-centre boundary, including an offset centre (State and ownership).

## 2. Skills and phases — 10 behaviors

1. Neutral and approved skills/dodge process before/at/after start, active, recovery and completion boundaries (Integer phases and tick arithmetic).
2. Melee deals no windup/recovery damage and accepts every configured active age (Integer phases and tick arithmetic).
3. Melee hits each hostile target once per action and retains sorted target ids (Minimal content and runtime records).
4. Melee misses outside range/arc and excludes friendly actors (Fixed system and hit resolution order).
5. Sector overlap includes hostile circles touching range/arc boundaries (Fixed system and hit resolution order).
6. Projectiles launch once at first active age, sweep immediately and preserve their launch latch (Minimal content; Integer phases).
7. Projectile lifetime permits exactly its configured sweeps and expires before the next sweep (Minimal content and runtime records).
8. A projectile consumes its first hostile contact and cannot damage another target afterward (Minimal content and runtime records).
9. A projectile ignores owner/friendly actors and misses off-path targets (Fixed system and hit resolution order).
10. Approved fixed damage needs three cuts or five darts for 72 health; the 20-damage strike uses its own timing (Minimal content; Integer phases).

## 3. Swept contacts and ordering — 5 behaviors

1. A fast projectile hits a target crossed between its endpoints (Fixed system and hit resolution order).
2. Travel fraction wins over target id when choosing a projectile's first contact (Fixed system and hit resolution order).
3. Equal-fraction contacts choose the lower target id (Fixed system and hit resolution order).
4. Simultaneous contacts sort by fraction, target, source actor, then projectile id (Fixed system and hit resolution order).
5. An earlier lethal/interruption contact invalidates later work from that source (Fixed system and hit resolution order).

## 4. Damage, pause and death — 11 behaviors

1. Incoming projectiles apply fixed damage and ordered hit/damage events with stable identities and copied positions (Fixed system and hit resolution order).
2. Knockback follows attack travel for its unpaused duration and stops at circular bounds, including diagonal travel (Hit-stop and interruption).
3. Later hits replace knockback and use maximum remaining pause/flash rather than adding durations (Hit-stop and interruption).
4. Impact pause freezes action/facing/locomotion/gait/knockback for exactly its next ticks (Hit-stop and interruption).
5. World ticks, aim/buttons, cooldowns, flash and flying projectiles continue during pause (Hit-stop and interruption).
6. Flash lasts exactly its configured world ticks, including the hit tick (Hit-stop and interruption).
7. Melee pauses both participants; projectile impact pauses only its target (Hit-stop and interruption).
8. Positive damage interrupts pending melee/projectile actions; zero damage does not interrupt (Hit-stop and interruption).
9. Lethal damage clamps applied damage, emits one death and clears action/motion/pause/owned projectiles (Hit-stop and interruption).
10. Lethal damage derives despawn duration from `ai.enemyId`; AI-free actors hold their terminal pose, and dead actors never collide (Hit-stop and interruption).
11. Immune dodge consumes incoming contact without damage, events, pause, flash, knockback or interruption (Hit-stop and interruption).

## 5. Snapshot continuation — 8 behaviors

1. Changing gait restores and continues with matching hashes, events, health, action and gait (Gait and rendering continuity).
2. Windup restores locked aim and continues with identical outcomes (Integer phases; Compatibility and verification).
3. Active melee restores hit ids and never repeats an accepted hit (Minimal content; Compatibility and verification).
4. Recovery restores its cancellation boundary and continues identically (Integer phases; Compatibility and verification).
5. Dodge restores travel, immunity, cooldown and held-button history (Aim, facing; Compatibility and verification).
6. Impact pause restores frozen action age and gait while world timers continue (Hit-stop; Gait and rendering continuity).
7. Projectile flight restores captured payload/age and launch latch without launching twice (Minimal content; Compatibility and verification).
8. Death restores terminal state and continues without new damage/death events (Hit-stop; Compatibility and verification).

## 6. Combat replay — 3 behaviors

1. A scripted 7,200-tick fight verifies all 120 periodic hashes plus initial/final state and contains real combat (Compatibility and verification).
2. Removing combat input reports divergence at the first affected 60-tick hash (Compatibility and verification).
3. Recorder checkpoint rotation preserves a verifiable combat window of at least 3,600 ticks, including a partial final second (Compatibility and verification).

## Fixture contract readings

- Neutral skills use 2/2/3 phases first; approved definitions independently use the M1 content card's values.
- Targets have `ai: null` except the despawn-source case; its definition reference requires no T1.5 enemy behavior.
- The strike is equipped on the controlled fixture actor to test mechanics independently of T1.5 AI.
- Incoming projectiles are plain setup data with valid owners, shared ids and captured payloads; fixtures round-trip before stepping.
- Phase probes have no contacts, so impact pause cannot shift the expected absolute tick; zero-windup dodge also checks pre-start.
- Full player input uses `GAIT.runSpeed` (2.521 m/s); enemies use their definition's `moveSpeed`, with no new state field.
- Arena data is `{ center: Vec2; radius: number } | null`; actor centres satisfy `distance(pos, center) <= radius`, and null is unbounded.
- At the lethal tick, `death.despawnAfterTicks` is the AI-referenced enemy definition's `deathTicks`, or null without AI; no seeded death is needed.
- Dart's nominal 10 m reach is 43 sweeps at 14 m/s (10.033 m); lifetime alone controls expiry, without a travel budget.
- The long harness uses twelve preplaced AI-free trios with normal M1 health/damage and one deterministic command stream, without heals/resets/spawns.
- Each trio becomes the script's target in a successive 600-tick interval; this is a fixture, separate from T1.5's replenishing `m1-fight` scenario.
- Recorder exports rotate; retain a separate tick-zero public replay for all 7,200 ticks, then verify rotated exports independently.
- Snapshot checks assert that the named state was reached before comparing continuation; inert M0 round trips cannot satisfy them.
