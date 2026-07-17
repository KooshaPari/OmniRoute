import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Project",
  description: "Documentation",
  
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Journeys', link: '/journeys/' },
      { text: 'Stories', link: '/stories/' },
      { text: 'Traceability', link: '/traceability/' },
      { text: 'API', link: '/reference/api' },
    ],
    
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quickstart' },
          ]
        }
      ],
      '/journeys/': [
        {
          text: 'User Journeys',
          items: [
            { text: 'Overview', link: '/journeys/' },
            { text: 'Quick Start', link: '/journeys/quick-start' },
            { text: 'Core Workflow', link: '/journeys/core-workflow' },
          ]
        }
      ],
      '/stories/': [
        {
          text: 'User Stories',
          items: [
            { text: 'Overview', link: '/stories/' },
            { text: 'Hello World', link: '/stories/hello-world' },
          ]
        }
      ],
      '/traceability/': [
        {
          text: 'Traceability',
          items: [
            { text: 'Overview', link: '/traceability/' },
            { text: 'Requirements', link: '/traceability/requirements' },
          ]
        }
      ],
    }
  }
})
