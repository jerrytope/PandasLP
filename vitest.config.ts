import { defineConfig } from 'vitest/config'

export default defineConfig({
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
