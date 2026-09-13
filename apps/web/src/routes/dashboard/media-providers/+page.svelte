<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let providers = $state<{ kind: string; id: string; name: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/media-providers'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { providers = d.providers ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Media Providers">
  {#if loading}
    <p class="text-gray-500">Loading media providers...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if providers.length === 0}
      <p class="text-gray-500">No media providers found.</p>
    {:else}
      <ul class="space-y-2">
        {#each providers as p (p.id)}
          <li class="flex items-center justify-between border-b py-2">
            <span class="font-medium">{p.name}</span>
            <span class="text-sm text-gray-500">{p.kind}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
