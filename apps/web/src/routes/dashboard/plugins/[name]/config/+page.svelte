<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { page } from '$app/stores';

  let config = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  const name = $derived($page.params.name);

  $effect(() => {
    fetch(bffApiUrl(`/api/dashboard/plugins/${encodeURIComponent(name)}/config`))
      .then(r => r.json())
      .then(d => { config = d.config ?? {}; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/plugins/${encodeURIComponent(name)}/config`), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="{name} configuration">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      {#if Object.keys(config).length === 0}
        <p class="text-gray-500">This plugin has no configurable options.</p>
      {:else}
        {#each Object.entries(config) as [key, value]}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
            {#if typeof value === 'boolean'}
              <div class="flex items-center gap-2">
                <input type="checkbox" bind:checked={config[key]} class="rounded" />
                <span class="text-sm text-gray-700">{value ? 'Enabled' : 'Disabled'}</span>
              </div>
            {:else if typeof value === 'number'}
              <input type="number" bind:value={config[key]} class="w-full px-3 py-2 border border-gray-300 rounded" />
            {:else}
              <input type="text" bind:value={config[key]} class="w-full px-3 py-2 border border-gray-300 rounded" />
            {/if}
          </div>
        {/each}
      {/if}
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
