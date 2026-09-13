<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let tools = $state<{ id: string; name: string; description: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/tools/search-tools'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { tools = d.tools ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Search Tools">
  {#if loading}
    <p class="text-gray-500">Loading search tools...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if tools.length === 0}
      <p class="text-gray-500">No search tools found.</p>
    {:else}
      <ul class="space-y-2">
        {#each tools as t (t.id)}
          <li class="border-b py-2">
            <span class="font-medium">{t.name}</span>
            <p class="text-xs text-gray-500">{t.description}</p>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
