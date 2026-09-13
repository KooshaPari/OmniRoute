<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Entry = { ts: string; event: string; detail: string };
  let entries = $state<Entry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/logs/timeline'));
      if (r.ok) entries = (await r.json()).entries ?? [];
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<svelte:head><title>Timeline</title></svelte:head>

<h1>Timeline</h1>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    {#each entries as e (e.ts + e.event)}
      <div class="tl-item"><span class="ts">[{e.ts}]</span> {e.event} — {e.detail}</div>
    {/each}
    {#if entries.length === 0}<span class="muted">No timeline.</span>{/if}
  </Card>
{/if}

<style>
  .tl-item { padding: .375rem 0; border-bottom: 1px solid var(--border); font-size: .875rem; }
  .ts { color: var(--text-muted); }
</style>
