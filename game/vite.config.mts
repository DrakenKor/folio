import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// The game builds on its own and lands in folio/public/play/, which the Next
// static export copies to out/play/.
export default defineConfig({
  root,
  base: '/play/',
  publicDir: 'assets-local/built',
  build: {
    outDir: '../public/play',
    emptyOutDir: true,
    target: 'es2022'
  },
  server: {
    port: 5173
  }
})
