<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { unavailableMessage } from '$lib/observability/unavailable';
  import { onMount } from 'svelte';

  type Diagnostics = {
    status?: 'unavailable';
    source?: string;
    uptimeSeconds: number | null;
    version: string | null;
    bffConnected: boolean | null;
    nextjsConnected: boolean | null;
    tauriShell: boolean | null;
    dbWalPosition: number | null;
    lastBackup: string | null;
    cacheHitRate: number | null;
    networkChecks: { url: string; ok: boolean; latencyMs: number }[];
  };

  let data = $state<Diagnostics | null>(null);
  let running = $state(false);
  let lastRun = $state<string | null>(null);

  async function run() {
    running = true;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/diagnostics/full'));
      if (r.ok) { data = await r.json(); lastRun = new Date().toISOString(); }
    } finally { running = false; }
  }

  onMount(run);
  const unavailable = $derived(unavailableMessage(data, 'Self-diagnostics'));
</script>

<Card title="Self-diagnostics">
  <div class="flex items-center justify-between mb-4">
    <p class="text-sm text-gray-600">Last run: {lastRun ?? 'never'}</p>
    <Button onclick={run} disabled={running}>{running ? 'Running...' : 'Run full diagnostic'}</Button>
  </div>
  {#if unavailable}
    <p class="text-gray-500">{unavailable}</p>
  {:else if data && data.uptimeSeconds != null && data.version != null && data.bffConnected != null && data.nextjsConnected != null && data.tauriShell != null && data.cacheHitRate != null}
    <div class="grid grid-cols-2 gap-3 text-sm mb-4">
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">Uptime</div>
        <div class="text-xl font-bold">{Math.floor(data.uptimeSeconds / 3600)}h {Math.floor((data.uptimeSeconds % 3600) / 60)}m</div>
      </div>
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">Version</div>
        <div class="text-xl font-bold font-mono">{data.version}</div>
      </div>
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">BFF connected</div>
        <div class="text-xl font-bold {data.bffConnected ? 'text-green-600' : 'text-red-600'}">{data.bffConnected ? 'yes' : 'no'}</div>
      </div>
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">Next.js connected</div>
        <div class="text-xl font-bold {data.nextjsConnected ? 'text-green-600' : 'text-red-600'}">{data.nextjsConnected ? 'yes' : 'no'}</div>
      </div>
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">Tauri shell</div>
        <div class="text-xl font-bold {data.tauriShell ? 'text-green-600' : 'text-red-600'}">{data.tauriShell ? 'yes' : 'no'}</div>
      </div>
      <div class="border border-gray-200 rounded p-3">
        <div class="text-xs text-gray-500">Cache hit rate</div>
        <div class="text-xl font-bold">{(data.cacheHitRate * 100).toFixed(1)}%</div>
      </div>
    </div>
    <h3 class="font-semibold mb-2">Network reachability</h3>
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr><th class="text-left px-3 py-2 font-semibold">URL</th><th class="text-left px-3 py-2 font-semibold">Status</th><th class="text-right px-3 py-2 font-semibold">Latency</th></tr>
      </thead>
      <tbody>
        {#each data.networkChecks as c}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-mono text-xs break-all">{c.url}</td>
            <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs {c.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">{c.ok ? 'ok' : 'fail'}</span></td>
            <td class="px-3 py-2 text-right">{c.latencyMs}ms</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
