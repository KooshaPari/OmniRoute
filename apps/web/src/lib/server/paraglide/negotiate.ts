/**
 * Negotiate the user's preferred Paraglide language from the request.
 * Falls back to 'en'.
 */
const SUPPORTED = ['en', 'es', 'ja', 'zh', 'de', 'fr', 'pt', 'ru'] as const;
type Supported = typeof SUPPORTED[number];

export function negotiateLanguage(req: Request | { request: { headers: Headers } }): Supported {
  const headers = req instanceof Request ? req.headers : req.request.headers;
  const cookieHeader = headers.get('cookie') ?? '';
  const fromCookie = /(?:^|;\s*)lang=([a-z]{2})/u.exec(cookieHeader)?.[1] as Supported | undefined;
  if (fromCookie && SUPPORTED.includes(fromCookie)) return fromCookie;
  const accept = headers.get('accept-language') ?? '';
  for (const tag of accept.split(',')) {
    const lang = tag.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(lang as Supported)) return lang as Supported;
  }
  return 'en';
}

export type { Supported };
export { SUPPORTED };
