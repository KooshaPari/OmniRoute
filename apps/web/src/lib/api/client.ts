import { hc } from 'hono/client';
import { bffApiUrl, bffBaseUrl } from '../bff-origin';

export const api = hc(bffBaseUrl());

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(bffApiUrl(path), { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
