import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const packageMetadata = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
  },
  build: {
    outDir: 'build',
  },
  server: {
    watch: {
      ignored: ['**/build/**', '**/dist/**', '**/release/**'],
    },
  },
  test: {
    environment: 'jsdom',
  },
})
