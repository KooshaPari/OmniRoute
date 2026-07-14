<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type CacheStats = { hits: number; misses: number; sizeMb: number; evictions: number };
  let stats = $state<CacheStats | null>(null);
  onMount(async () => {
    const r = await fetch('http://localhost:4322/api/dashboard/cache');
    if (r.ok) stats = await r.json();
  });
  const hitRate = $derived(stats ? stats.hits / Math.max(1, stats.hits + stats.misses) : 0);
</script>

<Card title="Cache">
  {#if stats}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div><div class="text-sm text-gray-500">Hit rate</div><div class="text-3xl font-bold">{(hitRate * 100).toFixed(1)}%</div></div>
      <div><div class="text-sm text-gray-500">Hits</div><div class="text-3xl font-bold">{stats.hits.toLocaleString()}</div></div>
      <div><div class="text-sm text-gray-500">Misses</div><div class="text-3xl font-bold">{stats.misses.toLocaleString()}</div></div>
      <div><div class="text-sm text-gray-500">Size</div><div class="text-3xl font-bold">{stats.sizeMb} MB</div></div>
    </div>
    <div class="mt-4 text-sm text-gray-500">Evictions: {stats.evictions.toLocaleString()}</div>
  {:else}
    <p class="text-gray-500">Loading cache stats...</p>
  {/if}
</Card>
