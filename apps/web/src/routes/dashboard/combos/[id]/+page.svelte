<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type Fallback = { model: string; condition: 'on-error' | 'on-rate-limit' | 'on-cost'; priority: number };
  type Combo = {
    id: string;
    name: string;
    primary: string;
    fallbacks: Fallback[];
    strategy: 'first-success' | 'round-robin' | 'cost-optimized' | 'latency-optimized';
    successRate: number;
    avgLatencyMs: number;
    createdAt: string;
    updatedAt: string;
  };

  let combo = $state<Combo | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let id = $derived($page.params.id ?? '');

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl(`/api/dashboard/combos/${id}`));
      if (res.ok) combo = await res.json();
      else error = `HTTP ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });

  const strategyColor: Record<Combo['strategy'], string> = {
    'first-success': 'bg-blue-100 text-blue-800',
    'round-robin': 'bg-purple-100 text-purple-800',
    'cost-optimized': 'bg-green-100 text-green-800',
    'latency-optimized': 'bg-yellow-100 text-yellow-800',
  };

  const conditionColor: Record<Fallback['condition'], string> = {
    'on-error': 'bg-red-100 text-red-800',
    'on-rate-limit': 'bg-yellow-100 text-yellow-800',
    'on-cost': 'bg-green-100 text-green-800',
  };
</script>

<Card title="Combo Detail">
  <p class="text-sm text-gray-600 mb-4">Combo configuration and performance metrics.</p>

  {#if loading}
    <p class="text-gray-500">Loading combo...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if combo}
    <div class="space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-500">ID</p>
          <p class="font-mono text-sm">{combo.id}</p>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-500">Strategy</p>
          <span class={`px-2 py-1 text-xs font-medium rounded-full ${strategyColor[combo.strategy]}`}>{combo.strategy}</span>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-500">Success Rate</p>
          <p class="text-2xl font-bold">{(combo.successRate * 100).toFixed(1)}%</p>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-500">Avg Latency</p>
          <p class="text-2xl font-bold">{combo.avgLatencyMs}ms</p>
        </div>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Primary Model</h3>
        <p class="font-mono text-lg">{combo.primary}</p>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Fallbacks</h3>
        {#if combo.fallbacks.length === 0}
          <p class="text-gray-500">No fallbacks configured.</p>
        {:else}
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b">
                <th class="pb-2">Priority</th>
                <th class="pb-2">Model</th>
                <th class="pb-2">Condition</th>
              </tr>
            </thead>
            <tbody>
              {#each combo.fallbacks as f (f.priority)}
                <tr class="border-b last:border-0">
                  <td class="py-2 font-mono">#{f.priority}</td>
                  <td class="py-2 font-mono">{f.model}</td>
                  <td class="py-2">
                    <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${conditionColor[f.condition]}`}>{f.condition}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <div class="border-t pt-4 flex gap-3">
        <Button variant="secondary" onclick={() => (window.location.href = `/dashboard/combos/${id}/live`)}>Live Stats</Button>
        <Button variant="secondary" onclick={() => (window.location.href = `/dashboard/combos/${id}/playground`)}>Playground</Button>
        <Button variant="primary" onclick={() => (window.location.href = `/dashboard/combos/${id}/edit`)}>Edit Combo</Button>
        <Button variant="ghost" onclick={() => (window.location.href = '/dashboard/combos')}>← All Combos</Button>
      </div>
    </div>
  {/if}
</Card>