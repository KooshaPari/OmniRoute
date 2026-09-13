<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let endpoints = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/api-endpoints'), { credentials: 'include' });
      if (res.ok) endpoints = (await res.json()).items ?? [];
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>API Endpoints - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">API Endpoints</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if endpoints.length === 0}
    <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      No API endpoints registered.
    </div>
  {:else}
    <div class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50">
            <th class="text-left p-3">Method</th>
            <th class="text-left p-3">Path</th>
            <th class="text-left p-3">Description</th>
            <th class="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each endpoints as ep (ep.path)}
            <tr class="border-b last:border-b-0">
              <td class="p-3 font-mono text-xs">{ep.method ?? 'GET'}</td>
              <td class="p-3 font-mono text-xs">{ep.path}</td>
              <td class="p-3 text-muted-foreground">{ep.description ?? '—'}</td>
              <td class="p-3">
                <span class={ep.active !== false ? 'text-green-600' : 'text-muted-foreground'}>
                  {ep.active !== false ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
