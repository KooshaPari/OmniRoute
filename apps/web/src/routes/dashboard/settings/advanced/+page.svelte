<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let debug = $state(false);
  let logLevel = $state('info');
  let maxConcurrent = $state(10);
  let requestTimeout = $state(30000);
  let cacheEnabled = $state(true);
  let cacheTtl = $state(300);
  let compression = $state(true);
  let rateLimit = $state(60);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/advanced'))
      .then(r => r.json())
      .then(d => {
        debug = d.debug; logLevel = d.logLevel;
        maxConcurrent = d.maxConcurrentRequests; requestTimeout = d.requestTimeoutMs;
        cacheEnabled = d.cacheEnabled; cacheTtl = d.cacheTtlSeconds;
        compression = d.compressionEnabled; rateLimit = d.rateLimitPerMinute;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/advanced'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ debug, logLevel, maxConcurrentRequests: maxConcurrent,
          requestTimeoutMs: requestTimeout, cacheEnabled, cacheTtlSeconds: cacheTtl,
          compressionEnabled: compression, rateLimitPerMinute: rateLimit }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Advanced settings">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      <div class="flex items-center gap-2">
        <input id="debug" type="checkbox" bind:checked={debug} class="rounded" />
        <label for="debug" class="text-sm text-gray-700">Debug mode</label>
      </div>
      <div>
        <label for="logLevel" class="block text-sm font-medium text-gray-700 mb-1">Log level</label>
        <select id="logLevel" bind:value={logLevel} class="w-full px-3 py-2 border border-gray-300 rounded">
          <option value="error">Error</option><option value="warn">Warn</option>
          <option value="info">Info</option><option value="debug">Debug</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Max concurrent requests</label>
        <input type="number" bind:value={maxConcurrent} min={1} max={100} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Request timeout (ms)</label>
        <input type="number" bind:value={requestTimeout} min={1000} max={120000} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div class="flex items-center gap-2">
        <input id="cacheEnabled" type="checkbox" bind:checked={cacheEnabled} class="rounded" />
        <label for="cacheEnabled" class="text-sm text-gray-700">Enable response cache</label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Cache TTL (seconds)</label>
        <input type="number" bind:value={cacheTtl} min={0} max={3600} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div class="flex items-center gap-2">
        <input id="compression" type="checkbox" bind:checked={compression} class="rounded" />
        <label for="compression" class="text-sm text-gray-700">Enable response compression</label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Rate limit (req/min)</label>
        <input type="number" bind:value={rateLimit} min={1} max={10000} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
