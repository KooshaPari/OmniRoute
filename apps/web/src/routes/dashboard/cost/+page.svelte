<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Row = { day: string; cost: number; tokens: number; requests: number };
  let rows = $state<Row[]>([]);
  let total = $derived(rows.reduce((s, r) => s + r.cost, 0));
  let max = $derived(Math.max(1, ...rows.map((r) => r.cost)));
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/cost'));
    if (r.ok) rows = (await r.json()).rows ?? [];
  });
</script>

<Card title="Cost (30d)">
  <div class="mb-4">
    <div class="text-3xl font-bold">${total.toFixed(2)}</div>
    <div class="text-sm text-gray-500">total this period</div>
  </div>
  <div class="flex items-end gap-1 h-32">
    {#each rows as r}
      <div class="flex-1 bg-blue-200 hover:bg-blue-400 rounded-t" style="height: {(r.cost / max) * 100}%" title="${r.cost.toFixed(2)} on {r.day}"></div>
    {/each}
  </div>
  <div class="mt-2 flex justify-between text-xs text-gray-500">
    <span>{rows[0]?.day ?? '—'}</span>
    <span>{rows[rows.length - 1]?.day ?? '—'}</span>
  </div>
</Card>
