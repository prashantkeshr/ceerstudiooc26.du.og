import { defineConfig } from 'vitest/config';

// Dedicated config so tests run in a plain Node environment without the app's
// build plugins (PWA, React). Tests cover pure logic only (no DOM/browser).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
