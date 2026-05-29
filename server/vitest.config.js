import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
