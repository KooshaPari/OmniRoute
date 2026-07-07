<script lang="ts">
  import { useQuery } from '@tanstack/svelte-query';
  import type { ApiKey } from '@omniroute/shared-types';

  const keys = useQuery<ApiKey[]>({
    queryKey: ['apikeys'],
    queryFn: async () => {
      const r = await fetch('/api/apikeys');
      if (!r.ok) throw new Error(`apikeys ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as ApiKey[];
    },
  });
</script>

<svelte:head><title>API Keys · argismonitor</title></svelte:head>

<section class="space-y-4 p-6">
  <header class="flex items-baseline justify-between">
    <h1 class="text-2xl font-bold">API Keys</h1>
    <a href="/apikeys/new" class="btn btn-sm btn-primary">+ Add key</a>
  </header>

  {#if keys.isPending}
    <p class="text-base-content/60">Loading…</p>
  {:else if keys.isError}
    <p class="text-error">{String(keys.error)}</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr><th>Label</th><th>Scope</th><th>Fingerprint</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          {#each keys.data ?? [] as k (k.id)}
            <tr>
              <td>{k.label}</td>
              <td><span class="badge badge-sm">{k.scope}</span></td>
              <td><code>…{k.fingerprint}</code></td>
              <td>{new Date(k.createdAt).toLocaleString()}</td>
              <td>
                {#if !k.revoked}
                  <button class="btn btn-xs btn-error">Revoke</button>
                {:else}
                  <span class="badge badge-error">revoked</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
