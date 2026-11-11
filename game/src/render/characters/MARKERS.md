# Character timing

The pure `characterPose` returns weights and absolute seconds. The adapter
samples them directly; gameplay never reads clip lengths or mixer events.

Measured from the pinned built knight at 30 samples/second. Sword-hand
trajectories identify the downward crossing (chop), diagonal crossing (slice),
forward thrust (stab), and forward release (casts). Recovery starts after the
follow-through. Sheets include the exact action contact and recovery ages.

All clips start at zero. Times below are seconds, rounded to three decimals.

| Clip | Contact | Recovery | End | Use |
| --- | ---: | ---: | ---: | --- |
| idle | — | — | 1.067 | Loop from world tick |
| walk | 0.228 | 0.761 | 1.067 | Left/right foot contact centres |
| run | 0.150 | 0.550 | 0.800 | Left/right foot contact centres |
| attack | 0.600 | 0.667 | 1.067 | Chop |
| attack_slice | 0.400 | 0.467 | 1.000 | Diagonal sweep |
| attack_stab | 0.400 | 0.800 | 1.600 | Thrust |
| cast | 0.267 | 0.333 | 0.933 | Release |
| cast_long | 1.533 | 1.600 | 2.533 | Long preparation, same gameplay contract |
| dodge | 0.000 | 0.267 | 0.400 | Active travel, then settle/blend out |
| block | — | — | 1.067 | Held loop, preview only |
| hit | 0.100 | 0.133 | 0.667 | Recoil, driven by remaining flash ticks |
| death | 0.533 | 0.567 | 0.800 | Ground contact, then terminal hold |

Walk/run left-foot offsets are 0.213541667/0.187500000 cycles. Measured speeds
are 0.561370/2.520919 m/s; simulation uses its fixed 0.561/2.521 values.
Gait phase comes exclusively from the snapshot, including unrendered steps.

Dodge's `root.position` travels from z=0 to z=0.25 source units (0.183453 m at
the measured 1.8 m model scale, 0.733811). The adapter clones the clip and
fixes root x/z to their first samples, preserving y and the shared asset.
Every other selected root track has no horizontal travel.

Windup maps start→contact, active maps contact→recovery, and recovery maps
recovery→end. Zero windup starts at contact; zero recovery reaches end directly.
Actions blend in over two ticks and out over the last four recovery ticks.
Death always overrides other states and holds the final sample indefinitely.
Hit recoil uses the content's maximum flash duration; flash presentation itself
is exposed in the pose for the feedback adapter.

Alpha zero samples current state after restore and manual stepping. Adjacent
actor samples interpolate matching action identities and unwrapped gait only;
world replacement discards them, and impact pause samples current state.

Preview: `/play/anim.html?clip=attack_slice&age=6`; the state menu includes all
12 clips, with tick stepping, scrubbing and a terminal hold. `?sheet=death`
uses the same sheet generator as `play.mjs sheet player death <out.png>`.

Run `fnm exec --using=24 node game/src/anim/check.mjs webgpu` and repeat with
`webgl` against Vite port 5197 and CDP 9577. Evidence is written beneath
`game/.play-out/t16/`; `combat.snapshot.json` is the AI-free Span Cut fixture
loaded through `__game.restore`, independent of T1.5 scenario registration.
