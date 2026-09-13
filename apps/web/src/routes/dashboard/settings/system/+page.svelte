<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let data = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/system'))
      .then(r => r.json())
      .then(d => { data = d; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  function formatUptime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
</script>

<Card title="System information">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else if error}<p class="text-red-600">{error}</p>
  {:else if data}
    <div class="space-y-3 max-w-2xl">
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Version</span>
        <span class="text-sm font-mono">{data.version}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Node.js</span>
        <span class="text-sm font-mono">{data.nodeVersion}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Platform</span>
        <span class="text-sm font-mono">{data.platform} ({data.arch})</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Uptime</span>
        <span class="text-sm">{formatUptime(data.uptimeSeconds as number)}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Memory usage</span>
        <span class="text-sm font-mono">{data.memoryUsageMb} MB</span>
      </div>
      <div class="flex justify-between items-center py-2">
        <span class="text-sm text-gray-700">CPU cores</span>
        <span class="text-sm font-mono">{data.cpuCount}</span>
      </div>
    </div>
  {/if}
</Card>
