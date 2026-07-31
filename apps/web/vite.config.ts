import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Svelte Flow publishes Svelte component source in its ESM entrypoint.
  // Let the Svelte plugin transform it instead of sending it through esbuild's
  // JavaScript-only dependency pre-bundler.
  optimizeDeps: { exclude: ['@xyflow/svelte'] },
  server: { port: 4321 }
});
