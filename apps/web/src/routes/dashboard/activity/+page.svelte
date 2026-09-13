<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Item = { ts: string; action: string; detail: string };
  let items = $state<Item[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/activity'));
      if (r.ok) items = (await r.json()).items ?? [];
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<svelte:head><title>Activity</title></svelte:head>

<h1>Activity</h1>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    {#each items as a (a.ts + a.action)}
      <div class="act-item"><span class="ts">[{a.ts}]</span> {a.action} — {a.detail}</div>
    {/each}
    {#if items.length === 0}<span class="muted">No recent activity.</span>{/if}
  </Card>
{/if}

<style>
  .act-item { padding: .375rem 0; border-bottom: 1px solid var(--border); font-size: .875rem; }
  .ts { color: var(--text-muted); }
</style>
