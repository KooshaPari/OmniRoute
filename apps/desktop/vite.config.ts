import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  server: { port: 5174, host: '0.0.0.0', strictPort: true },
  build: { target: 'es2022', sourcemap: true, outDir: 'build' },
  clearScreen: false,
});
