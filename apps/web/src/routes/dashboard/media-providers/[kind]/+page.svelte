<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let kind = $state('');
  let providers = $state<{ id: string; name: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    kind = $page.params.kind ?? '';
    if (!kind) { loading = false; return; }
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/media-providers/${encodeURIComponent(kind)}`));
      if (r.ok) { const d = await r.json(); providers = d.providers ?? []; error = null; }
      else error = `HTTP ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
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
