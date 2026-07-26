<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Row = { model: string; provider: string; requests: number; tokens: number; cost: number };
  let rows = $state<Row[]>([]);
  let sortBy = $state<keyof Row>('cost');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let loading = $state(true);

  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/usage/by-model'));
    if (r.ok) { rows = (await r.json()).rows ?? []; }
    loading = false;
  });

  const totalCost = $derived(rows.reduce((s, r) => s + r.cost, 0));
  const sorted = $derived(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  function toggleSort(col: keyof Row) {
    if (sortBy === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = col; sortDir = 'desc'; }
  }
</script>

<Card title="Usage by model (30d)">
  {#if loading}
    <p class="text-gray-500">Loading...</p>
  {:else if rows.length === 0}
    <p class="text-gray-500">No usage recorded.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          {#each ['model', 'provider', 'requests', 'tokens', 'cost'] as col}
            <th onclick={() => toggleSort(col as keyof Row)} class="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100">{col} {sortBy === col ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
          {/each}
          <th class="text-right px-3 py-2 font-semibold">% of total</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted() as r (r.model + r.provider)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-mono text-xs">{r.model}</td>
            <td class="px-3 py-2">{r.provider}</td>
            <td class="px-3 py-2">{r.requests.toLocaleString()}</td>
            <td class="px-3 py-2">{r.tokens.toLocaleString()}</td>
            <td class="px-3 py-2">${r.cost.toFixed(2)}</td>
            <td class="px-3 py-2 text-right">{((r.cost / Math.max(0.01, totalCost)) * 100).toFixed(1)}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
