import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../bff/src/trpc/router';

const BFF_BASE = typeof window !== 'undefined'
  ? (window as any).__OMNIRoute_BFF_URL__ ?? 'http://localhost:4322'
  : 'http://localhost:4322';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BFF_BASE}/api/trpc`,
      fetch: (input, init) => fetch(input as RequestInfo | URL, { ...init, credentials: 'include' }),
    }),
  ],
});
