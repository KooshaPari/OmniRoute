import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'parpour',
  description: 'Documentation',
  base: '/parpour/',
  cleanUrls: true,
  ignoreDeadLinks: true,
  // Raw conversation/context dumps under docs/context/** are source material,
  // not doc pages — exclude from the VitePress build (they contain prose that
  // trips the Vue/markdown compiler, e.g. unclosed angle-bracket tokens).
  srcExclude: ['**/context/**', '**/fragemented/**'],
  // esbuild rejects destructuring when the build target is too low (default
  // chrome87/es2020 trips on theme chunks). Bump to es2022.
  vite: { build: { target: 'es2022' } },
  themeConfig: {
    nav: [{ text: 'Guide', link: '/guide/' }],
    sidebar: [],
  },
})
