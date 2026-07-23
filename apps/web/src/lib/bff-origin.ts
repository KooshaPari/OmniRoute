const DEFAULT_BFF_ORIGIN = 'http://localhost:4322';

type BrowserBffGlobals = Window & {
  __OMNIROUTE_BFF_URL__?: string;
  /** Legacy typo kept for compatibility with older injectors. */
  __OMNIRoute_BFF_URL__?: string;
};

function sanitizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Browser BFF base URL — injected global, same-origin, or local default.
 * Never embeds BFF_API_KEY (#392).
 */
export function bffBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_BFF_ORIGIN;
  const g = window as BrowserBffGlobals;
  const injected = g.__OMNIROUTE_BFF_URL__ ?? g.__OMNIRoute_BFF_URL__;
  if (typeof injected === 'string') {
    const origin = sanitizeOrigin(injected);
    if (origin) return origin;
  }
  // SvelteKit Vite default is :4321; BFF default is :4322.
  if (window.location?.port === '4321') return DEFAULT_BFF_ORIGIN;
  if (window.location?.origin) return window.location.origin;
  return DEFAULT_BFF_ORIGIN;
}

export function bffApiUrl(pathname: string): string {
  const base = bffBaseUrl().replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}
