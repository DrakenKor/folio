# Portfolio WASM crate

Rust compiled to WebAssembly with `wasm-bindgen`. One crate, one binary
(`portfolio_wasm_bg.wasm`) and one glue file (`portfolio_wasm.js`), split into
five modules. `src/lib.rs` holds only the console bindings and macros, the panic
hook, the `wee_alloc` allocator and the `mod` declarations.

## Modules

| File | Exports |
| --- | --- |
| `src/core.rs` | `greet`, `performance_test`, `force_gc`, `WASMModule`, `fibonacci`, `prime_sieve`, `matrix_multiply`, `sum_array`, `sort_array`, `find_max`, `find_min`, `reverse_string`, `count_words`, `safe_divide`, `get_memory_usage` |
| `src/image.rs` | New: `convolve`, `color_matrix`, `gaussian_blur`, `sobel`. Older: `ImageProcessor`, `apply_blur`, `apply_edge_detection`, `apply_color_filter`, `adjust_brightness`, `adjust_contrast`, `apply_sharpen` |
| `src/crypto.rs` | New: `sha256`. Older: `simple_hash`, `fnv1a_hash`, `checksum`, `crc32`, `demo_md5_hash`, `demo_sha_hash`, the classical ciphers, `hash_to_color`, `hash_to_pattern`, `crypto_performance_test`, `demonstrate_avalanche_effect`, `find_simple_collision`, `calculate_entropy` |
| `src/bench.rs` | `mandelbrot`, `mandelbrot_rows`, `nbody` |
| `src/physics.rs` | `Particle`, `ParticleSystem`, `physics_performance_test` |

`core.rs` and `physics.rs` are wrapped by `src/lib/wasm-core-loader.ts`: do not
rename them or change their signatures.

### Image primitives

`convolve`, `color_matrix`, `gaussian_blur` and `sobel` work in place on RGBA
bytes. Edges clamp to the nearest pixel, alpha is never modified, arithmetic is
f64, results are rounded with `floor(x + 0.5)` and clamped to 0..=255, and each
call allocates at most one temporary buffer. `src/lib/image-filters.ts` holds the
JavaScript twins with the same loop order; `src/test/image-filters.test.ts`
checks the two agree within 1 per channel.

### Benchmark workloads

`mandelbrot` and `mandelbrot_rows` fill a `width * height` byte buffer with
escape counts capped at 255. `nbody` advances a 2D system in place; its
operation order is copied exactly by the JavaScript twin, so do not reorder the
arithmetic.

### Hashing

`sha256` uses the `sha2` crate. `crc32`, `fnv1a_hash` and `simple_hash` are
small hand-written functions.

## Building

Install wasm-pack:

```bash
cargo install wasm-pack --version 0.15.0 --locked
```

The repository's `rust-toolchain.toml` installs Rust 1.98.1 and the WASM target.
Then, from the project root:

```bash
npm run build:wasm
```

This runs `bash wasm/build.sh`, which builds with `--locked` (update
`Cargo.lock` first when adding a dependency, for example with
`cargo check --target wasm32-unknown-unknown`) and writes to `public/wasm/`:

- `portfolio_wasm.js` - JavaScript bindings
- `portfolio_wasm_bg.wasm` - WebAssembly binary

`public/wasm/` is gitignored and built in CI by the same command. Tests that need
the binary (`image-filters`, `wasm-exports`) skip visibly when it is missing.

## Loading

`src/lib/wasm.ts` is the loader: `loadWasm()` imports the glue with a native ESM
`import()` and instantiates it from bytes it fetches itself.
