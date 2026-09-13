<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let kind = $state('');
  let providers = $state<{ id: string; name: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    kind = new URLSearchParams(window.location.search).get('kind') ?? '';
    if (!kind) { loading = false; return; }
    fetch(bffApiUrl(`/api/dashboard/media-providers/${encodeURIComponent(kind)}`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { providers = d.providers ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Media Providers by Kind">
  {#if loading}
    <p class="text-gray-500">Loading providers...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <p class="text-sm text-gray-500 mb-3">Kind: {kind}</p>
    {#if providers.length === 0}
      <p class="text-gray-500">No providers of kind {kind}.</p>
    {:else}
      <ul class="space-y-2">
        {#each providers as p (p.id)}
          <li class="border-b py-2 font-medium">{p.name} ({p.id})</li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
