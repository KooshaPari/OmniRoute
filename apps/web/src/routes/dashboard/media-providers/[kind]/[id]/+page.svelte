<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let provider = $state<{ kind: string; id: string; name: string; config?: Record<string, unknown> } | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    const { kind, id } = Object.fromEntries(new URLSearchParams(window.location.search));
    if (!kind || !id) { error = 'Missing kind or id'; loading = false; return; }
    fetch(bffApiUrl(`/api/dashboard/media-providers/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { provider = d; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Media Provider Details">
  {#if loading}
    <p class="text-gray-500">Loading provider...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if !provider}
    <p class="text-gray-500">Provider not found.</p>
  {:else}
    <p><span class="font-medium">Kind:</span> {provider.kind}</p>
    <p><span class="font-medium">ID:</span> {provider.id}</p>
    <p><span class="font-medium">Name:</span> {provider.name}</p>
    {#if provider.config}
      <details class="text-sm mt-2">
        <summary class="cursor-pointer text-blue-600">Config</summary>
        <pre class="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(provider.config, null, 2)}</pre>
      </details>
    {/if}
  {/if}
</Card>
