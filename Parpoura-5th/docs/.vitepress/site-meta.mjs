export function createSiteMeta({ base = '/' } = {}) {
  return {
    base,
    title: 'parpour',
    description: 'parpour documentation',
    themeConfig: {
      nav: [
        { text: 'Home', link: base || '/' },
        { text: 'Guide', link: '/guide/' },
      ],
    },
  }
}
