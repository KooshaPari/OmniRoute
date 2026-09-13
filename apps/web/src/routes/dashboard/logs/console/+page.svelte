<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount, onDestroy } from 'svelte';
  type Entry = { ts: string; level: 'debug'|'info'|'warn'|'error'; message: string };
  let entries = $state<Entry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/logs/console'));
      if (r.ok) entries = (await r.json()).entries ?? [];
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  }
  onMount(() => { poll(); timer = setInterval(poll, 3000); });
  onDestroy(() => { if (timer) clearInterval(timer); });

  const levelColor = { debug: 'text-gray-500', info: 'text-blue-700', warn: 'text-yellow-700', error: 'text-red-700' } as const;
</script>

<svelte:head><title>Console</title></svelte:head>

<h1>Console</h1>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    <div class="bg-gray-900 text-gray-100 font-mono text-xs p-4 rounded h-96 overflow-y-auto">
      {#each entries as e (e.ts + e.message)}
        <div><span class="text-gray-500">[{e.ts}]</span> <span class={levelColor[e.level]}>{e.level.toUpperCase()}</span> {e.message}</div>
      {/each}
      {#if entries.length === 0}<span class="text-gray-500">No entries.</span>{/if}
    </div>
  </Card>
{/if}

<style></style>
