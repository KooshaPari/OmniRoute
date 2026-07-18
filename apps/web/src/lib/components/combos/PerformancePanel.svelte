<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { unavailableMessage } from '$lib/observability/unavailable';
  import { onMount } from 'svelte';

  type Row = { model: string; provider: string; requests: number; p50: number; p95: number; p99: number; successRate: number; cost: number };
  type PerformanceResponse = { status?: 'unavailable'; source?: string; rows: Row[] };

  let range = $state<'1h' | '24h' | '7d'>('24h');
  let rows = $state<Row[]>([]);
  let unavailable = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    const r = await fetch(`http://localhost:4322/api/dashboard/performance?range=${range}`);
    if (r.ok) {
      const j = await r.json() as PerformanceResponse;
      unavailable = unavailableMessage(j, 'Runtime model aggregation');
      rows = j.rows ?? [];
    }
    loading = false;
  });
</script>

<Card title={`Performance (last ${range})`}>
  <div class="flex items-center gap-2 mb-3">
    {#each ['1h', '24h', '7d'] as r}
      <button
        class="px-2 py-1 text-xs rounded {range === r ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'}"
        onclick={() => range = r as '1h' | '24h' | '7d'}
      >
        {r}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="text-gray-500 text-sm">Loading performance data...</p>
  {:else if unavailable}
    <p class="text-gray-500 text-sm" data-testid="performance-unavailable">
      {unavailable}
    </p>
  {:else if rows.length === 0}
    <p class="text-gray-500 text-sm">No data in this range.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="text-left px-3 py-2 font-semibold">Model</th>
          <th class="text-right px-3 py-2 font-semibold">Requests</th>
          <th class="text-right px-3 py-2 font-semibold">p50</th>
          <th class="text-right px-3 py-2 font-semibold">p95</th>
          <th class="text-right px-3 py-2 font-semibold">p99</th>
          <th class="text-right px-3 py-2 font-semibold">Success</th>
          <th class="text-right px-3 py-2 font-semibold">Cost</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.model)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-mono text-xs">{r.model}</td>
            <td class="px-3 py-2 text-right">{r.requests.toLocaleString()}</td>
            <td class="px-3 py-2 text-right">{r.p50}ms</td>
            <td class="px-3 py-2 text-right">{r.p95}ms</td>
            <td class="px-3 py-2 text-right">{r.p99}ms</td>
            <td class="px-3 py-2 text-right">{(r.successRate * 100).toFixed(1)}%</td>
            <td class="px-3 py-2 text-right">${r.cost.toFixed(2)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
