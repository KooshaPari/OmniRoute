/**
 * Client hooks: SvelteQuery + theme bootstrap.
 */
import { QueryClient } from '@tanstack/svelte-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export const init = async () => {
  // Theme is applied via data-theme on <html>; theme toggle lives in +layout.svelte.
  return { queryClient };
};

export { queryClient };
