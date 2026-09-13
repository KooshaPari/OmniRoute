<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  let stats = $state<any>(null);
  let encoding = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    loading = true;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/compression/stats'));
      if (r.ok) stats = await r.json();
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });

  async function runLive() {
    encoding = true;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/compression/ab'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '' }) });
      if (r.ok) stats = await r.json();
    } catch (e) { error = (e as Error).message; }
    finally { encoding = false; }
  }
</script>

<svelte:head>
  <title>Compression Live</title>
</svelte:head>

<h1>Compression Live</h1>

<div class="actions">
  <Button onclick={runLive} disabled={encoding}>{encoding ? 'Running…' : 'Run live'}</Button>
</div>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    <p class="muted">Status: {stats?.status ?? 'unavailable'} · source: {stats?.source ?? 'placeholder'}</p>
    <div class="stats-grid">
      <div class="stat"><span class="label">GCF bytes</span><span class="value">{stats?.gcfBytes ?? 0}</span></div>
      <div class="stat"><span class="label">TOON bytes</span><span class="value">{stats?.toonBytes ?? 0}</span></div>
      <div class="stat"><span class="label">JSON bytes</span><span class="value">{stats?.jsonBytes ?? 0}</span></div>
      <div class="stat"><span class="label">Prompts</span><span class="value">{stats?.prompts ?? 0}</span></div>
    </div>
  </Card>
{/if}

<style>
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-top: 1rem; }
  .stat { display: flex; flex-direction: column; gap: .25rem; }
  .label { font-size: .875rem; color: var(--text-muted); }
  .value { font-size: 1.25rem; font-weight: 600; }
  .muted { color: var(--text-muted); }
  .actions { margin-bottom: 1rem; }
  :global(.error) { border-color: var(--danger); }
</style>
