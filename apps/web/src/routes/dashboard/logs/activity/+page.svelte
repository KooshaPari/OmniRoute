<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Activity = { ts: string; action: string; status: string };
  let activity = $state<Activity[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/logs/activity'));
      if (r.ok) activity = (await r.json()).activity ?? [];
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<svelte:head><title>Logs — Activity</title></svelte:head>

<h1>Activity</h1>

{#if loading}<Card>Loading…</Card>
{:else if error}<Card class="error">{error}</Card>
{:else}
  <Card>
    {#each activity as a (a.ts)}
      <div class="act-item"><span class="ts">[{a.ts}]</span> {a.action} — {a.status}</div>
    {/each}
    {#if activity.length === 0}<span class="muted">No activity.</span>{/if}
  </Card>
{/if}

<style>
  .act-item { padding: .375rem 0; border-bottom: 1px solid var(--border); font-size: .875rem; }
  .ts { color: var(--text-muted); }
</style>
