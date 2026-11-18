import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
let build = 'dev'
try { build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() } catch { /* Git is optional in build archives. */ }
const metadata = JSON.stringify({ build }) + '\n'

// The game builds on its own and lands in folio/public/play/, which the Next
// static export copies to out/play/.
export default defineConfig({
  root,
  base: '/play/',
  publicDir: 'assets-local/built',
  define: { __BUILD_ID__: JSON.stringify(build) },
  plugins: [{
    name: 'game-build-metadata',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?', 1)[0] !== '/play/build.json' || (req.method !== 'GET' && req.method !== 'HEAD')) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(req.method === 'HEAD' ? undefined : metadata)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: metadata })
    }
  }],
  build: {
    outDir: '../public/play',
    emptyOutDir: true,
    target: 'es2022'
  },
  server: {
    port: 5173,
    // Harness captures and test fixtures land here; writing them must not reload the page under test.
    watch: { ignored: ['**/.play-out/**'] }
  }
})
