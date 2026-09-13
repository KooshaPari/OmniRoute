<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';

  let text = $state('');
  let mode = $state('lite');
  let result = $state<any>(null);
  let running = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    loading = true;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/compression/studio'));
      if (r.ok) result = await r.json();
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });

  async function run() {
    running = true;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/compression/studio'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      });
      if (r.ok) result = await r.json();
    } catch (e) { error = (e as Error).message; }
    finally { running = false; }
  }
</script>

<svelte:head>
  <title>Compression Studio</title>
</svelte:head>

<h1>Compression Studio</h1>

<div class="field">
  <label>Text</label>
  <textarea bind:value={text} rows={6} placeholder="Enter prompt…" />
</div>
<div class="field">
  <label>Mode</label>
  <select bind:value={mode}>
    <option>lite</option>
    <option>standard</option>
    <option>aggressive</option>
  </select>
</div>

<div class="actions">
  <Button onclick={run} disabled={running}>{running ? 'Encoding…' : 'Encode'}</Button>
</div>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    <p class="muted">Mode: {result?.mode ?? 'lite'}</p>
    <p class="muted">Result: {result?.result ? 'available' : 'none'}</p>
  </Card>
{/if}

<style>
  .field { margin-bottom: 1rem; }
  textarea, select { width: 100%; padding: .5rem; border: 1px solid var(--border); border-radius: .375rem; }
  .actions { margin-bottom: 1rem; }
  .muted { color: var(--text-muted); font-size: .875rem; }
  :global(.error) { border-color: var(--danger); }
</style>
