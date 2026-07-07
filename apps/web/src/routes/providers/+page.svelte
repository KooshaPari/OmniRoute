<script lang="ts">
  import { useQuery, useQueryClient, createMutation } from '@tanstack/svelte-query';
  import type { ProviderPublic } from '@omniroute/shared-types';

  const qc = useQueryClient();

  const providers = useQuery<ProviderPublic[]>({
    queryKey: ['providers'],
    queryFn: async () => {
      const r = await fetch('/api/providers');
      if (!r.ok) throw new Error(`providers ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as ProviderPublic[];
    },
  });

  function ping(id: string) {
    return fetch(`/api/providers/${id}/health`, { method: 'POST' });
  }
</script>

<svelte:head><title>Providers · argismonitor</title></svelte:head>

<section class="space-y-4 p-6">
  <header class="flex items-baseline justify-between">
    <h1 class="text-2xl font-bold">Providers</h1>
    <a href="/providers/new" class="btn btn-sm btn-primary">+ New</a>
  </header>

  {#if providers.isPending}
    <p class="text-base-content/60">Loading…</p>
  {:else if providers.isError}
    <p class="text-error">{String(providers.error)}</p>
  {:else if providers.data && providers.data.length === 0}
    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <p class="text-base-content/60">No providers yet. Add one to start routing.</p>
        <a href="/providers/new" class="btn btn-primary">Add provider</a>
      </div>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="table table-zebra">
        <thead>
          <tr><th>Name</th><th>Kind</th><th>Status</th><th>Models</th><th></th></tr>
        </thead>
        <tbody>
          {#each providers.data ?? [] as p (p.id)}
            <tr>
              <td><a href="/providers/{p.id}" class="link">{p.displayName}</a></td>
              <td><span class="badge">{p.kind}</span></td>
              <td>
                <span class="badge" class:badge-success={p.status === 'active'} class:badge-warning={p.status === 'paused'} class:badge-error={p.status === 'error'}>
                  {p.status}
                </span>
              </td>
              <td>{p.enabledModels.length}</td>
              <td><button class="btn btn-xs" onclick={() => ping(p.id)}>Health</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
