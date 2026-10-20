/**
 * BFF (Backend-for-Frontend) URL helpers.
 *
 * In the SvelteKit app all data-fetching goes through the BFF layer instead
 * of calling internal Next.js API routes directly.  The base is read from
 * the `VITE_BFF_API_URL` environment variable at build/runtime; when unset it
 * defaults to the same-origin so that the BFF is assumed to be co-located
 * with the SvelteKit server.
 */
export const bffBaseUrl = (): string => import.meta.env.VITE_BFF_API_URL ?? "";

export const bffApiUrl = (path: string): string => `${bffBaseUrl()}${path}`;
