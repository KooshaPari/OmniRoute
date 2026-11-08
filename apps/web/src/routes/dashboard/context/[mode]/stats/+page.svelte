<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let stats = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let mode = $derived($page.params.mode ?? '');

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl(`/api/dashboard/context/${mode}/stats`));
      if (res.ok) stats = await res.json();
      else error = `HTTP ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<Card title="{mode} Stats">
  <p class="text-sm text-gray-600 mb-4">Live compression stats for the {mode} engine.</p>

  {#if loading}
    <p class="text-gray-500">Loading stats...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <div class="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Requests</p>
        <p class="text-2xl font-bold">{stats?.requestsTotal?.toLocaleString() ?? 0}</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Tokens Saved</p>
        <p class="text-2xl font-bold">{(stats?.tokensOriginal ?? 0 - stats?.tokensCompressed ?? 0).toLocaleString() ?? 0}</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Savings</p>
        <p class="text-2xl font-bold">{(stats?.savingsPct ?? 0).toFixed(1)}%</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Avg Latency</p>
        <p class="text-2xl font-bold">{(stats?.avgLatencyMs ?? 0)}ms</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">P50 Latency</p>
        <p class="text-xl font-bold">{(stats?.p50LatencyMs ?? 0)}ms</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">P99 Latency</p>
        <p class="text-xl font-bold">{(stats?.p99LatencyMs ?? 0)}ms</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Error Rate</p>
        <p class="text-xl font-bold">{(stats?.errorRate ?? 0) * 100}%</p>
      </div>
      <div class="stat p-3 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Fallback Rate</p>
        <p class="text-xl font-bold">{(stats?.fallbackRate ?? 0) * 100}%</p>
      </div>
    </div>
  {/if}
</Card>