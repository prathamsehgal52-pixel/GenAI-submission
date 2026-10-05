import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/server/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/server/globalSetup.ts'],
    setupFiles: ['tests/server/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
