# Character assets

Verified on 2026-11-10. Large sources, licences and generated binaries stay in
gitignored `game/assets-local/`.

| Pack | Author | Licence | Used content |
| --- | --- | --- | --- |
| [KayKit Adventurers 1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/tree/672074b73ba276876a19e8816ecdc5241817ab47) | Kay Lousberg | [CC0 1.0](https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/672074b73ba276876a19e8816ecdc5241817ab47/addons/kaykit_character_pack_adventures/LICENSE.txt) | Knight mesh, embedded palette texture, rig, sword, round shield and animation clips |

The pack's CC0 licence covers its models, textures and included animations.
The local copy is `assets-local/src/kaykit-adventurers-1.0/LICENSE.txt`.
No separate animation pack or retargeting is required for this rig.

`tools/assets/fetch-sources.mjs` pins the source commit and checks SHA-256:

| Source file | SHA-256 |
| --- | --- |
| `Knight.glb` | `60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168` |
| `LICENSE.txt` | `ae322141814056dda0deea7540d74c41d87aee1da319977cd1bd84ee5a923629` |

Run from the repository root with the installed Node 24 and glTF Transform 4.5.1:

```sh
fnm exec --using=24 node game/tools/assets/fetch-sources.mjs
fnm exec --using=24 node game/tools/assets/build-characters.mjs
```

The conversion selects clips and accessories, prunes unused data, resamples
animation tracks and meshopt-compresses the result. The palette texture is
embedded; the runtime applies three toon bands, a cool rim and tinted outlines.

Output: `assets-local/built/pack/characters/knight.glb` (422,108 bytes).
SHA-256: `7a51c8a4e17652355e5b9865420b5d625b9e0508309f9a2878ccc19c7fd8bd45`.
Clips: `idle`, `walk`, `run`, `attack`, `attack_slice`, `attack_stab`, `cast`,
`cast_long`, `dodge`, `block`, `hit`, `death`.

At 1.8 m character height, measured walk/run speeds are 0.561/2.521 m/s,
with strides of 0.599/2.017 m. Their left-foot contact phases align for blending.
Part 2 should integrate gait phase from simulation distance and use the existing
rig for action timing. Dodge retains 0.25 source units of forward root travel;
remove or account for it when simulation movement drives the character.
Terrain foot placement and turning need later polish. Blender retargeting is
unnecessary for the selected clips.
