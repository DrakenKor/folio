import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
let build = 'dev'
try { build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() } catch { /* Git is optional in build archives. */ }

// The game builds on its own and lands in folio/public/play/, which the Next
// static export copies to out/play/.
export default defineConfig({
  root,
  base: '/play/',
  publicDir: 'assets-local/built',
  define: { __BUILD_ID__: JSON.stringify(build) },
  build: {
    outDir: '../public/play',
    emptyOutDir: true,
    target: 'es2022'
  },
  server: {
    port: 5173
  }
})
