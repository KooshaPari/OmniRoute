<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Provider = { provider: string; total: number; trend: 'up' | 'down' | 'flat'; daily: { day: string; cost: number }[] };
  let providers = $state<Provider[]>([]);
  let loading = $state(true);
  onMount(async () => {
    const r = await fetch('http://localhost:4322/api/dashboard/cost/by-provider');
    if (r.ok) { providers = (await r.json()).providers ?? []; }
    loading = false;
  });
  const total = $derived(providers.reduce((s, p) => s + p.total, 0));
  const allDays = $derived(Array.from(new Set(providers.flatMap((p) => p.daily.map((d) => d.day)))).sort());
</script>

<Card title="Cost by provider (30d)">
  {#if loading}
    <p class="text-gray-500">Loading...</p>
  {:else if providers.length === 0}
    <p class="text-gray-500">No cost data.</p>
  {:else}
    <div class="mb-4">
      <div class="text-sm text-gray-500 mb-1">Total: <span class="font-bold text-gray-900">${total.toFixed(2)}</span></div>
      <div class="flex h-32 rounded overflow-hidden border border-gray-200">
        {#each providers as p (p.provider)}
          <div class="bg-blue-500 hover:bg-blue-600" style="width: {(p.total / Math.max(0.01, total)) * 100}%; height: 100%" title="{p.provider}: ${p.total.toFixed(2)} ({((p.total / total) * 100).toFixed(1)}%)"></div>
        {/each}
      </div>
    </div>
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr><th class="text-left px-3 py-2 font-semibold">Provider</th><th class="text-right px-3 py-2 font-semibold">Total</th><th class="text-right px-3 py-2 font-semibold">%</th><th class="text-right px-3 py-2 font-semibold">Trend</th></tr>
      </thead>
      <tbody>
        {#each providers as p (p.provider)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-medium">{p.provider}</td>
            <td class="px-3 py-2 text-right">${p.total.toFixed(2)}</td>
            <td class="px-3 py-2 text-right">{((p.total / total) * 100).toFixed(1)}%</td>
            <td class="px-3 py-2 text-right">{p.trend === 'up' ? '^' : p.trend === 'down' ? 'v' : '='}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
