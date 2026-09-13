<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  interface Plugin { name: string; displayName: string; version: string; enabled: boolean; description: string; category: string }
  let plugins = $state<Plugin[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/plugins'))
      .then(r => r.json())
      .then(d => { plugins = d.plugins; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function toggle(plugin: Plugin) {
    plugin.enabled = !plugin.enabled;
    plugins = [...plugins];
  }
</script>

<Card title="Plugins">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else if error}<p class="text-red-600">{error}</p>
  {:else if plugins.length === 0}
    <p class="text-gray-500">No plugins installed.</p>
  {:else}
    <div class="divide-y divide-gray-200">
      {#each plugins as plugin}
        <div class="flex items-center justify-between py-3">
          <div>
            <a href="/dashboard/plugins/{plugin.name}" class="text-sm font-medium text-blue-600 hover:underline">{plugin.displayName}</a>
            <p class="text-xs text-gray-500">v{plugin.version} &middot; {plugin.description}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{plugin.category}</span>
            <button onclick={() => toggle(plugin)} class="text-sm px-2 py-1 rounded {plugin.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
              {plugin.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>
