<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { unavailableMessage } from '$lib/observability/unavailable';
  import { onMount } from 'svelte';
  type CacheStats = {
    status?: 'unavailable';
    source?: string;
    hits: number | null;
    misses: number | null;
    sizeMb: number | null;
    evictions: number | null;
  };
  let stats = $state<CacheStats | null>(null);
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/cache'));
    if (r.ok) stats = await r.json();
  });
  const unavailable = $derived(unavailableMessage(stats, 'Cache metrics'));
  const metrics = $derived(stats?.hits != null && stats.misses != null && stats.sizeMb != null && stats.evictions != null
    ? { hits: stats.hits, misses: stats.misses, sizeMb: stats.sizeMb, evictions: stats.evictions }
    : null);
  const hitRate = $derived(metrics ? metrics.hits / Math.max(1, metrics.hits + metrics.misses) : 0);
</script>

<Card title="Cache">
  {#if unavailable}
    <p class="text-gray-500">{unavailable}</p>
  {:else if metrics}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div><div class="text-sm text-gray-500">Hit rate</div><div class="text-3xl font-bold">{(hitRate * 100).toFixed(1)}%</div></div>
      <div><div class="text-sm text-gray-500">Hits</div><div class="text-3xl font-bold">{metrics.hits.toLocaleString()}</div></div>
      <div><div class="text-sm text-gray-500">Misses</div><div class="text-3xl font-bold">{metrics.misses.toLocaleString()}</div></div>
      <div><div class="text-sm text-gray-500">Size</div><div class="text-3xl font-bold">{metrics.sizeMb} MB</div></div>
    </div>
    <div class="mt-4 text-sm text-gray-500">Evictions: {metrics.evictions.toLocaleString()}</div>
  {:else}
    <p class="text-gray-500">Loading cache stats...</p>
  {/if}
</Card>
