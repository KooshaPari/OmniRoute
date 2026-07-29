import { env } from '$env/dynamic/private';

// The packaged Electrobun runtime starts the Bun BFF on 20128.  Keep this
// default aligned with the desktop process; development can still override
// it with BFF_ORIGIN (for example, a separately running BFF on 4322).
const DEFAULT_BFF_ORIGIN = 'http://127.0.0.1:20128';

export function bffUrl(pathname: string): URL {
  const origin = new URL(env.BFF_ORIGIN ?? DEFAULT_BFF_ORIGIN);
  if (!['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('BFF_ORIGIN must use http or https');
  }
  if (origin.username || origin.password) {
    throw new Error('BFF_ORIGIN must not contain credentials');
  }
  return new URL(pathname, origin);
}
