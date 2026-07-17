import { bffUrl } from '$lib/server/bff';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 4096;

export const POST: RequestHandler = async ({ request, fetch }) => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    error(415, 'content-type must be application/json');
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) error(413, 'payload too large');
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) error(413, 'payload too large');

  const response = await fetch(bffUrl('/api/v1/telemetry/web-vitals'), {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
};
