<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';

  type UsageRow = {
    id: string;
    provider: string;
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    date: string;
  };

  let rows = $state<UsageRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let sortBy = $state<keyof UsageRow>('date');
  let sortDir = $state<'asc' | 'desc'>('desc');

  onMount(async () => {
    try {
      const res = await fetch('http://localhost:4322/api/dashboard/usage', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        rows = j.rows ?? [];
      } else {
        error = `BFF returned ${res.status}`;
      }
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });

  const sorted = $derived(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  });

  function toggleSort(col: keyof UsageRow) {
    if (sortBy === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = col;
      sortDir = 'desc';
    }
  }
</script>

<Card title="Usage (30d)">
  {#if loading}
    <p class="text-gray-500">Loading usage from BFF...</p>
  {:else if error}
    <p class="text-red-600 text-sm">{error}</p>
  {:else if sorted().length === 0}
    <p class="text-gray-500">No usage recorded yet.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            {#each ['date', 'provider', 'model', 'requests', 'tokens', 'cost'] as col}
              <th class="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-gray-100" onclick={() => toggleSort(col as keyof UsageRow)}>
                {col} {sortBy === col ? (sortDir === 'asc' ? '^' : 'v') : ''}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each sorted() as r (r.id)}
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-3 py-2">{r.date}</td>
              <td class="px-3 py-2">{r.provider}</td>
              <td class="px-3 py-2 font-mono text-xs">{r.model}</td>
              <td class="px-3 py-2">{r.requests.toLocaleString()}</td>
              <td class="px-3 py-2">{r.tokens.toLocaleString()}</td>
              <td class="px-3 py-2">${r.cost.toFixed(4)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
