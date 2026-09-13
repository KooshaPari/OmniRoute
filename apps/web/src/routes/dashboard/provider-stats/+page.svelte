<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let stats = $state<Record<string, number | string>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/provider-stats'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { stats = d.stats ?? {}; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Provider Stats">
  {#if loading}
    <p class="text-gray-500">Loading stats...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <dl class="grid grid-cols-2 gap-2 text-sm">
      {#each Object.entries(stats) as [k, v] (k)}
        <div class="border-b py-1">
          <dt class="text-gray-500">{k}</dt>
          <dd class="font-medium">{v}</dd>
        </div>
      {/each}
      {#if Object.keys(stats).length === 0}
        <p class="text-gray-500 col-span-2">No stats available.</p>
      {/if}
    </dl>
  {/if}
</Card>
