import { hc } from 'hono/client';

const BFF_BASE = typeof window !== 'undefined'
  ? (window as any).__OMNIRoute_BFF_URL__ ?? 'http://localhost:4322'
  : 'http://localhost:4322';

export const api = hc(BFF_BASE);

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BFF_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
