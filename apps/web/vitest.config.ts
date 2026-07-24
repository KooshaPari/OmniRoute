// Minimal vitest config for apps/web. The full SvelteKit vite config is
// only needed for building the app; vitest in this package currently has no
// *.test.* files, so we expose only TypeScript-aware stub configuration.
// If/when component tests are added, replace this with the recommended
// `@sveltejs/vitest` setup (`defineConfig` + `sveltekit()` for the browser,
// plus a `node` project for pure-TS tests).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Scaffolding phase: no tests have been authored yet. Allow `vitest run`
    // to succeed so CI stays green while the test suite is still being built.
  },
});
