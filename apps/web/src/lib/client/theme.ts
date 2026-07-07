/** Theme tokens and toggling. */
export type Theme = 'dark' | 'light' | 'system';
export const THEME_STORAGE_KEY = 'argis.theme';

export function applyTheme(theme: Theme): void {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
}
