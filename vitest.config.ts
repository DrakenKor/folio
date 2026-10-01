import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Shader sources import as strings, as raw-loader does for the Next build
  plugins: [
    {
      name: 'glsl-raw',
      transform(code, id) {
        if (id.endsWith('.glsl')) return `export default ${JSON.stringify(code)}`
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
