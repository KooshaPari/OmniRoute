import { bffUrl } from '$lib/server/bff';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const res = await fetch(bffUrl('/api/dashboard/health').toString());
    if (res.ok) {
      return { bffHealthy: true, ts: new Date().toISOString() };
    }
  } catch {
    // BFF not running; fall through
  }
  return { bffHealthy: false, ts: new Date().toISOString() };
};
