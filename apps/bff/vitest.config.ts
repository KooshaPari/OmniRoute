// Minimal vitest config for apps/bff. The package currently has no
// *.test.* files, so we expose a node-environment stub. When integration
// tests are added (e.g. exercising the Hono router with @hono/node-server),
// switch `environment` to `'node'` and add `setupFiles` if needed.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Scaffolding phase: no tests have been authored yet. Allow `vitest run`
    // to succeed so CI stays green while the test suite is still being built.
  },
});
