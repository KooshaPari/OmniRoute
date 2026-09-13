<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let admin = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/gamification/admin'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { admin = d.admin ?? {}; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Gamification Admin">
  {#if loading}
    <p class="text-gray-500">Loading admin data...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <dl class="grid grid-cols-2 gap-2 text-sm">
      {#each Object.entries(admin) as [k, v] (k)}
        <div class="border-b py-1">
          <dt class="text-gray-500">{k}</dt>
          <dd class="font-medium">{String(v)}</dd>
        </div>
      {/each}
      {#if Object.keys(admin).length === 0}
        <p class="text-gray-500 col-span-2">No admin data.</p>
      {/if}
    </dl>
  {/if}
</Card>
