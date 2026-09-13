<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount, onDestroy } from 'svelte';
  type Entry = { ts: string; path: string; status: number; latencyMs: number };
  let entries = $state<Entry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/logs/proxy'));
      if (r.ok) entries = (await r.json()).entries ?? [];
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  }
  onMount(() => { poll(); timer = setInterval(poll, 3000); });
  onDestroy(() => { if (timer) clearInterval(timer); });
</script>

<svelte:head><title>Proxy Logs</title></svelte:head>

<h1>Proxy</h1>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <table class="data-table">
    <thead><tr><th>Time</th><th>Path</th><th>Status</th><th>Latency (ms)</th></tr></thead>
    <tbody>
      {#each entries as e (e.ts + e.path)}
        <tr><td>[{e.ts}]</td><td>{e.path}</td><td>{e.status}</td><td>{e.latencyMs}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .data-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  .data-table th, .data-table td { padding: .375rem; border-bottom: 1px solid var(--border); text-align: left; }
  .data-table th { color: var(--text-muted); }
</style>
