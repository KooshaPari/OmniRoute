<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let endpoint = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/endpoint'), { credentials: 'include' });
      if (res.ok) endpoint = (await res.json()).endpoint ?? {};
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Endpoint Details - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Endpoint Details</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else}
    <div class="rounded-lg border bg-card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <span class="font-medium">Method</span>
        <span class="font-mono">{endpoint.method ?? '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Path</span>
        <span class="font-mono text-sm">{endpoint.path ?? '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Description</span>
        <span>{endpoint.description ?? '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Rate Limit</span>
        <span>{endpoint.rateLimit ?? '—'} req/min</span>
      </div>
    </div>
  {/if}
</div>
