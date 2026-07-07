import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { port: 5173, host: '0.0.0.0', strictPort: true },
  preview: { port: 5173, host: '0.0.0.0' },
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    globals: false,
  },
});
