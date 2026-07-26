<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount, onDestroy } from 'svelte';
  type Log = { ts: string; level: 'debug'|'info'|'warn'|'error'; service: string; message: string };
  let logs = $state<Log[]>([]);
  let level = $state<'all' | 'info' | 'warn' | 'error'>('all');
  let timer: ReturnType<typeof setInterval> | null = null;
  async function poll() {
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/logs?level=${level}`));
      if (r.ok) logs = (await r.json()).logs ?? [];
    } catch {}
  }
  onMount(() => { poll(); timer = setInterval(poll, 3000); });
  onDestroy(() => { if (timer) clearInterval(timer); });
  const levelColor = { debug: 'text-gray-500', info: 'text-blue-700', warn: 'text-yellow-700', error: 'text-red-700' } as const;
</script>

<Card title="Logs (live)">
  <div class="flex items-center gap-2 mb-3">
    <label for="logs-level" class="text-sm text-gray-700">Filter:</label>
    <select id="logs-level" bind:value={level} class="px-2 py-1 border border-gray-300 rounded text-sm">
      <option value="all">all</option>
      <option value="info">info+</option>
      <option value="warn">warn+</option>
      <option value="error">error only</option>
    </select>
    <span class="ml-auto text-xs text-gray-500">polling every 3s</span>
  </div>
  <div class="bg-gray-900 text-gray-100 font-mono text-xs p-4 rounded h-96 overflow-y-auto">
    {#each logs as l (l.ts + l.message)}
      <div class="whitespace-pre-wrap">
        <span class="text-gray-500">[{l.ts}]</span>
        <span class={levelColor[l.level]}>{l.level.toUpperCase()}</span>
        <span class="text-purple-400">{l.service}</span>
        {l.message}
      </div>
    {/each}
    {#if logs.length === 0}
      <div class="text-gray-500">No log entries.</div>
    {/if}
  </div>
</Card>
