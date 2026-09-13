<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let agents = $state<{ id: string; name: string; skills: string[] }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/agents/acp'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { agents = d.agents ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="ACP Agents">
  {#if loading}
    <p class="text-gray-500">Loading ACP agents...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if agents.length === 0}
      <p class="text-gray-500">No ACP agents found.</p>
    {:else}
      <ul class="space-y-2">
        {#each agents as a (a.id)}
          <li class="border-b py-2">
            <span class="font-medium">{a.name}</span>
            <span class="text-sm text-gray-500">({a.id})</span>
            {#if a.skills.length}
              <div class="text-xs text-gray-600 mt-1">Skills: {a.skills.join(', ')}</div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
