<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let apis = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/api-manager'), { credentials: 'include' });
      if (res.ok) apis = (await res.json()).items ?? [];
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>API Manager - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">API Manager</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if apis.length === 0}
    <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      No APIs configured. Create one to get started.
    </div>
  {:else}
    <div class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50">
            <th class="text-left p-3">Name</th>
            <th class="text-left p-3">Base URL</th>
            <th class="text-left p-3">Auth</th>
            <th class="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each apis as api (api.id ?? api.name)}
            <tr class="border-b last:border-b-0">
              <td class="p-3 font-medium">{api.name}</td>
              <td class="p-3 font-mono text-xs">{api.baseUrl ?? '—'}</td>
              <td class="p-3 text-muted-foreground">{api.authType ?? 'None'}</td>
              <td class="p-3">
                <span class={api.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}>
                  {api.status ?? 'unknown'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
