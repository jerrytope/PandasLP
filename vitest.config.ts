import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Mirrors tsconfig.json's "@/*" -> "./*" path mapping — Next.js resolves this on its own,
  // but vitest doesn't read tsconfig paths, so any test importing a module that itself uses
  // an `@/` import (e.g. an app/api/**/route.ts file) fails to resolve without this.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // Loads .env.local into process.env — see vitest.setup.ts. Runs inside each test
    // worker, unlike calling loadEnvConfig directly in this file (which only affects the
    // main config-loading process, not the separate worker threads tests actually run in).
    setupFiles: ['./vitest.setup.ts'],
  },
})
