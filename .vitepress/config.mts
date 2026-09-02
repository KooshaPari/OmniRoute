import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OmniRoute',
  description: 'Phenotype OmniRoute fork — AI gateway with routing, load balancing, retries, and fallbacks',
  lang: 'en-US',
  srcDir: 'docs-site',
  base: '/omniroute/',
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Operations', link: '/operations/' },
      { text: 'Demo', link: '/demo/' },
    ],
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/getting-started/' },
            { text: 'Install', link: '/getting-started/install' },
            { text: 'Quickstart', link: '/getting-started/quickstart' },
            { text: 'On-device Demo', link: '/getting-started/on-device' },
            { text: 'Deploy', link: '/getting-started/deploy' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Canonical Routing ADR', link: '/architecture/adr-001' },
            { text: 'Repository Map', link: '/architecture/repository-map' },
            { text: 'Cluster Decisions', link: '/architecture/cluster-decisions' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'API Reference', link: '/reference/api' },
            { text: 'Provider Plugin Manifest', link: '/reference/provider-manifest' },
            { text: 'Environment Variables', link: '/reference/environment' },
            { text: 'Feature Flags', link: '/reference/feature-flags' },
            { text: 'CLI Tools', link: '/reference/cli' },
          ],
        },
      ],
      '/operations/': [
        {
          text: 'Operations',
          items: [
            { text: 'Overview', link: '/operations/' },
            { text: 'Runbook', link: '/operations/runbook' },
            { text: 'Incident Response', link: '/operations/incident-response' },
            { text: 'Perf Initiative', link: '/operations/perf-initiative' },
            { text: 'Cost', link: '/operations/cost' },
            { text: 'Threat Model', link: '/operations/threat-model' },
            { text: 'Backlog', link: '/operations/backlog' },
          ],
        },
      ],
      '/demo/': [
        {
          text: 'Demo',
          items: [
            { text: 'Overview', link: '/demo/' },
            { text: 'GUI Walkthrough', link: '/demo/gui' },
            { text: 'Stress Test', link: '/demo/stress-test' },
            { text: 'On-device', link: '/demo/on-device' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/KooshaPari/OmniRoute' },
    ],
    footer: {
      message: 'Fork of diegosouzapw/OmniRoute — Phenotype governance applies.',
      copyright: 'Copyright © KooshaPari/OmniRoute',
    },
  },
  vite: {
    server: { host: '127.0.0.1', port: 5173 },
  },
})
