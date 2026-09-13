<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let dataDir = $state('./data');
  let logDir = $state('./logs');
  let cacheDir = $state('./cache');
  let exportDir = $state('./exports');
  let tempDir = $state('./tmp');
  let pluginDir = $state('./plugins');
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/paths'))
      .then(r => r.json())
      .then(d => {
        dataDir = d.dataDir; logDir = d.logDir; cacheDir = d.cacheDir;
        exportDir = d.exportDir; tempDir = d.tempDir; pluginDir = d.pluginDir;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/paths'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataDir, logDir, cacheDir, exportDir, tempDir, pluginDir }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="File paths">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Data directory</label>
        <input type="text" bind:value={dataDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Log directory</label>
        <input type="text" bind:value={logDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Cache directory</label>
        <input type="text" bind:value={cacheDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Export directory</label>
        <input type="text" bind:value={exportDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Temp directory</label>
        <input type="text" bind:value={tempDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Plugin directory</label>
        <input type="text" bind:value={pluginDir} class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm" />
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
