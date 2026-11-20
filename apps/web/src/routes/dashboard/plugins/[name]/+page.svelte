<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { page } from '$app/stores';

  let plugin = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const name = $derived($page.params.name);

  $effect(() => {
    fetch(bffApiUrl(`/api/dashboard/plugins/${encodeURIComponent(name)}`))
      .then(r => r.json())
      .then(d => { plugin = d; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title={plugin?.displayName ?? name ?? 'Plugin'}>
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else if error}<p class="text-red-600">{error}</p>
  {:else if plugin}
    <div class="space-y-3 max-w-2xl">
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Version</span>
        <span class="text-sm font-mono">{plugin.version}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Author</span>
        <span class="text-sm">{plugin.author}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Category</span>
        <span class="text-sm">{plugin.category}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Status</span>
        <span class="text-sm font-medium {plugin.enabled ? 'text-green-600' : 'text-gray-500'}">{plugin.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="py-2">
        <span class="text-sm text-gray-700">Description</span>
        <p class="text-sm text-gray-600 mt-1">{plugin.description}</p>
      </div>
      <div class="flex gap-3 pt-2">
        <a href="/dashboard/plugins/{name}/config" class="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">Configure</a>
      </div>
    </div>
  {/if}
</Card>
