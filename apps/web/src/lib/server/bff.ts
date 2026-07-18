import { env } from '$env/dynamic/private';

const DEFAULT_BFF_ORIGIN = 'http://127.0.0.1:4322';

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
