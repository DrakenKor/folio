# WASM Image Processing Module

This directory contains Rust code for high-performance image processing using WebAssembly (WASM).

## Building the WASM Module

The demo will work without WASM (using JavaScript fallback), but for optimal performance:

### Prerequisites

Install wasm-pack:
```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

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
