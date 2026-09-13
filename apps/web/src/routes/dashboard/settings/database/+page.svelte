<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let engine = $state('sqlite');
  let dbPath = $state('./data/omniroute.db');
  let walMode = $state(true);
  let backupEnabled = $state(false);
  let backupInterval = $state(24);
  let poolSize = $state(5);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/database'))
      .then(r => r.json())
      .then(d => {
        engine = d.engine; dbPath = d.path; walMode = d.walMode;
        backupEnabled = d.backupEnabled; backupInterval = d.backupIntervalHours;
        poolSize = d.connectionPoolSize;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/database'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ engine, path: dbPath, walMode, backupEnabled,
          backupIntervalHours: backupInterval, connectionPoolSize: poolSize }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Database settings">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Engine</label>
        <select bind:value={engine} class="w-full px-3 py-2 border border-gray-300 rounded">
          <option value="sqlite">SQLite</option><option value="postgres">PostgreSQL</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Database path</label>
        <input type="text" bind:value={dbPath} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div class="flex items-center gap-2">
        <input id="wal" type="checkbox" bind:checked={walMode} class="rounded" />
        <label for="wal" class="text-sm text-gray-700">WAL mode (SQLite)</label>
      </div>
      <div class="flex items-center gap-2">
        <input id="backup" type="checkbox" bind:checked={backupEnabled} class="rounded" />
        <label for="backup" class="text-sm text-gray-700">Enable automatic backups</label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Backup interval (hours)</label>
        <input type="number" bind:value={backupInterval} min={1} max={168} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Connection pool size</label>
        <input type="number" bind:value={poolSize} min={1} max={50} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
