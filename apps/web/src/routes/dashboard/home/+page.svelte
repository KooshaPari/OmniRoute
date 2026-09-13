<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let stats = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/home'), { credentials: 'include' });
      if (res.ok) stats = (await res.json()).stats ?? {};
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Home - OmniRoute Dashboard</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Dashboard Overview</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-lg border bg-card p-6">
        <p class="text-sm text-muted-foreground">Active Providers</p>
        <p class="text-3xl font-bold mt-2">{stats.activeProviders ?? 0}</p>
      </div>
      <div class="rounded-lg border bg-card p-6">
        <p class="text-sm text-muted-foreground">Requests Today</p>
        <p class="text-3xl font-bold mt-2">{stats.requestsToday ?? 0}</p>
      </div>
      <div class="rounded-lg border bg-card p-6">
        <p class="text-sm text-muted-foreground">Cost Today</p>
        <p class="text-3xl font-bold mt-2">${stats.costToday ?? '0.00'}</p>
      </div>
    </div>
  {/if}
</div>
