<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { unavailableMessage } from '$lib/observability/unavailable';
  import { onMount } from 'svelte';

  type Overview = {
    status?: 'unavailable'; source?: string;
    p50: number | null; p95: number | null; p99: number | null;
    rps: number | null; errorRate: number | null;
  };
  type Point = { ts: string; latency: number };
  type Endpoint = { path: string; method: string; rps: number };

  let overview = $state<Overview | null>(null);
  let series = $state<Point[]>([]);
  let topEndpoints = $state<Endpoint[]>([]);
  const unavailable = $derived(unavailableMessage(overview, 'Runtime latency aggregation'));

  onMount(async () => {
    const [a, b, c] = await Promise.all([
      fetch(bffApiUrl('/api/dashboard/observability/overview')).then((r) => r.ok ? r.json() : null),
      fetch(bffApiUrl('/api/dashboard/observability/timeseries')).then((r) => r.ok ? r.json() : null),
      fetch(bffApiUrl('/api/dashboard/observability/top-endpoints')).then((r) => r.ok ? r.json() : null),
    ]);
    overview = a; series = b?.points ?? []; topEndpoints = c?.endpoints ?? [];
  });
</script>

<div class="space-y-4">
  <Card title="Observability overview (last 1h)">
    {#if unavailable}
      <p class="text-gray-500" data-testid="observability-unavailable">
        {unavailable}
      </p>
    {:else if overview && overview.p50 !== null && overview.p95 !== null && overview.p99 !== null && overview.rps !== null && overview.errorRate !== null}
      <div class="grid grid-cols-5 gap-3">
        <div><div class="text-xs text-gray-500">p50</div><div class="text-2xl font-bold">{overview.p50}ms</div></div>
        <div><div class="text-xs text-gray-500">p95</div><div class="text-2xl font-bold">{overview.p95}ms</div></div>
        <div><div class="text-xs text-gray-500">p99</div><div class="text-2xl font-bold">{overview.p99}ms</div></div>
        <div><div class="text-xs text-gray-500">RPS</div><div class="text-2xl font-bold">{overview.rps}</div></div>
        <div><div class="text-xs text-gray-500">Error rate</div><div class="text-2xl font-bold text-red-600">{(overview.errorRate * 100).toFixed(2)}%</div></div>
      </div>
    {/if}
  </Card>

  <Card title="Latency (last 1h)">
    {#if series.length > 0}
      {@const max = Math.max(1, ...series.map((p) => p.latency))}
      <div class="flex items-end gap-px h-32">
        {#each series as p}
          <div class="flex-1 bg-blue-300 hover:bg-blue-500" style="height: {(p.latency / max) * 100}%" title="{p.ts}: {p.latency}ms"></div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-500">No latency samples.</p>
    {/if}
  </Card>

  <Card title="Top 10 endpoints by RPS">
    {#if topEndpoints.length > 0}
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr><th class="text-left px-3 py-2 font-semibold">Path</th><th class="text-left px-3 py-2 font-semibold">Method</th><th class="text-right px-3 py-2 font-semibold">RPS</th></tr>
        </thead>
        <tbody>
          {#each topEndpoints as e}
            <tr class="border-b border-gray-100">
              <td class="px-3 py-2 font-mono text-xs">{e.path}</td>
              <td class="px-3 py-2">{e.method}</td>
              <td class="px-3 py-2 text-right">{e.rps.toFixed(1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="text-gray-500">No endpoint data.</p>
    {/if}
  </Card>
</div>
