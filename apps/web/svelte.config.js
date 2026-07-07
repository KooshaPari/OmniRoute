import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build', precompress: false, envPrefix: 'PUBLIC_' }),
    alias: {
      $lib: 'src/lib',
      '$lib/*': 'src/lib/*',
    },
    csrf: { checkOrigin: true },
    typescript: { config: (cfg) => cfg },
    version: { pollInterval: 0 },
  },
  compilerOptions: {
    runes: true,
    // No legacy mode — runes only.
  },
};

export default config;
