import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.integration.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
