import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const res = await fetch('http://localhost:4322/api/dashboard/health');
    if (res.ok) {
      return { bffHealthy: true, ts: new Date().toISOString() };
    }
  } catch {
    // BFF not running; fall through
  }
  return { bffHealthy: false, ts: new Date().toISOString() };
};
