<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  let exclusions = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/compression/exclusions'));
      if (r.ok) exclusions = await r.json();
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<svelte:head>
  <title>Compression Exclusions</title>
</svelte:head>

<h1>Compression Exclusions</h1>

<div class="field">
  <label>No exclusions configured</label>
</div>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  {#each exclusions as e}
    <div class="exclusion-item">{e.pattern ?? 'unnamed'} — {e.action ?? 'allow'}</div>
  {/each}
{:else}<span class="ok">No exclusions</span>{/if}

<style>
  .exclusion-item { padding: .5rem; border-bottom: 1px solid var(--border); font-size: .875rem; }
  :global(.ok) { color: var(--success); }
</style>
