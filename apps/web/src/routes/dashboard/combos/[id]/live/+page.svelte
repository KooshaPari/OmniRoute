<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type LiveStats = {
    totalRequests: number;
    successful: number;
    failed: number;
    fallbackRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    costSavedUsd: number;
    lastUpdated: string;
  };

  let stats = $state<LiveStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let refreshKey = $state(0);
  let id = $derived($page.params.id ?? '');

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await fetch(bffApiUrl(`/api/dashboard/combos/${id}/live`));
      if (res.ok) stats = await res.json();
      else error = `HTTP ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<Card title="{id} Live Stats">
  <div class="flex items-center justify-between mb-4">
    <p class="text-sm text-gray-600">Live run data for combo {id}</p>
    <Button variant="secondary" size="sm" onclick={load} disabled={loading}>Refresh</Button>
  </div>

  {#if loading}
    <p class="text-gray-500">Loading live data...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if stats}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Total Requests</p>
        <p class="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Successful</p>
        <p class="text-2xl font-bold">{stats.successful.toLocaleString()}</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Failed</p>
        <p class="text-2xl font-bold">{stats.failed.toLocaleString()}</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Fallback Rate</p>
        <p class="text-2xl font-bold">{(stats.fallbackRate * 100).toFixed(1)}%</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Avg Latency</p>
        <p class="text-xl font-bold">{stats.avgLatencyMs}ms</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">P95 Latency</p>
        <p class="text-xl font-bold">{stats.p95LatencyMs}ms</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Cost Saved</p>
        <p class="text-xl font-bold">${stats.costSavedUsd.toFixed(2)}</p>
      </div>
      <div class="stat p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Last Updated</p>
        <p class="text-sm font-mono">{new Date(stats.lastUpdated).toLocaleTimeString()}</p>
      </div>
    </div>
  {/if}
</Card>