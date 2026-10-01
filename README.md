Manav Da's Folio.

Stack:
NextJS
TailwindCSS
TSParticle

## Getting Started

Use Node.js 24 and the Rust version in `rust-toolchain.toml`. Install wasm-pack 0.15.0, then build the WASM module before the site:

```bash
npm ci
npm run build:wasm
npm run build
```

For local development, run `npm run dev` after building WASM.
