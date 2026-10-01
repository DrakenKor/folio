# WASM Image Processing Module

This directory contains Rust code for high-performance image processing using WebAssembly (WASM).

## Building the WASM Module

The demo will work without WASM (using JavaScript fallback), but for optimal performance:

### Prerequisites

Install wasm-pack:
```bash
cargo install wasm-pack --version 0.15.0 --locked
```

The repository's `rust-toolchain.toml` installs Rust 1.98.1 and the WASM target through rustup.

### Build

From the project root:
```bash
npm run build:wasm
```

Or directly from this directory:
```bash
bash build.sh
```

This will generate optimized WASM files in `public/wasm/`:
- `portfolio_wasm.js` - JavaScript bindings
- `portfolio_wasm_bg.wasm` - WebAssembly binary

## How It Works

When WASM is available, the image processing demo uses highly optimized Rust implementations for:
- Gaussian blur
- Edge detection
- Color filters (sepia, grayscale, invert, channel isolation)
- Brightness/contrast adjustments
- Sharpening

Without WASM, the demo falls back to JavaScript implementations automatically.
