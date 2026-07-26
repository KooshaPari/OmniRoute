import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../bff/src/trpc/router';
import { bffApiUrl } from '../bff-origin';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: bffApiUrl('/api/trpc'),
      fetch: (input, init) => fetch(input as RequestInfo | URL, { ...init, credentials: 'include' }),
    }),
  ],
});
