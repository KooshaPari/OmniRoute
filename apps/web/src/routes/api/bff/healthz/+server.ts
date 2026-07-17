import { bffUrl } from '$lib/server/bff';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
  const response = await fetch(bffUrl('/healthz'));
  if (!response.ok) error(502, `BFF health check failed with HTTP ${response.status}`);
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
};
