export function createSiteMeta({ base = '/' } = {}) {
  return {
    base,
    title: 'agent-wave',
    description: 'Documentation',
    themeConfig: {
      nav: [
        { text: 'Home', link: base || '/' },
      ],
    },
  }
}
