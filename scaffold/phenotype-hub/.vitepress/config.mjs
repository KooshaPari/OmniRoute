import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Phenotype Hub',
  description: 'Phenotype Hub documentation',
  srcDir: 'docs',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Journeys', link: '/journeys/' },
      { text: 'Operations', link: '/operations/' },
      { text: 'Worklogs', link: '/worklogs/' }
    ],
    sidebar: {
      '/journeys/': [{ items: [] }],
      '/operations/': [{ items: [] }],
      '/worklogs/': [{ items: [] }]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/KooshaPari/phenotype-hub' }
    ]
  }
})
