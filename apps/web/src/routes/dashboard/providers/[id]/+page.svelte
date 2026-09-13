<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let provider = $state<{ id: string; name: string; type: string; config: Record<string, unknown> } | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    const id = $page.params.id;
    if (!id) { error = 'Missing id'; loading = false; return; }
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/providers/${id}`));
      if (r.ok) { provider = await r.json(); error = null; }
      else error = `HTTP ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<Card title="Provider Details">
  {#if loading}
    <p class="text-gray-500">Loading provider...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if !provider}
    <p class="text-gray-500">Provider not found.</p>
  {:else}
    <div class="space-y-2">
      <p><span class="font-medium">ID:</span> {provider.id}</p>
      <p><span class="font-medium">Name:</span> {provider.name}</p>
      <p><span class="font-medium">Type:</span> {provider.type}</p>
      <details class="text-sm">
        <summary class="cursor-pointer text-blue-600">Config</summary>
        <pre class="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(provider.config, null, 2)}</pre>
      </details>
    </div>
  {/if}
</Card>
