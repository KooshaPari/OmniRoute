<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let agents = $state<{ id: string; name: string; connected: boolean }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/agents/cloud'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { agents = d.agents ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Cloud Agents">
  {#if loading}
    <p class="text-gray-500">Loading cloud agents...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if agents.length === 0}
      <p class="text-gray-500">No cloud agents found.</p>
    {:else}
      <ul class="space-y-2">
        {#each agents as a (a.id)}
          <li class="flex items-center justify-between border-b py-2">
            <span class="font-medium">{a.name}</span>
            <span class="text-sm" class:text-green-600={a.connected} class:text-red-600={!a.connected}>
              {a.connected ? 'Connected' : 'Disconnected'}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
