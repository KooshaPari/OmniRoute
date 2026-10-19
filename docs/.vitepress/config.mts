import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OmniRoute',
  description: 'OmniRoute documentation',
  base: '/OmniRoute/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/getting-started/' },
      { text: 'Compete', link: '/compete/' }
    ],
    sidebar: [
      { text: 'Getting started', link: '/getting-started/' },
      { text: 'Compete', link: '/compete/' }
    ]
  }
})
