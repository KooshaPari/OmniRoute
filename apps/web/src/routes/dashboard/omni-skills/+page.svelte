<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let skills = $state<{ id: string; name: string; enabled: boolean }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/skills/omni-skills'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { skills = d.skills ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Omni Skills">
  {#if loading}
    <p class="text-gray-500">Loading omni skills...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if skills.length === 0}
      <p class="text-gray-500">No omni skills found.</p>
    {:else}
      <ul class="space-y-2">
        {#each skills as s (s.id)}
          <li class="flex items-center justify-between border-b py-2">
            <span class="font-medium">{s.name}</span>
            <span class="text-sm" class:text-green-600={s.enabled} class:text-gray-500={!s.enabled}>
              {s.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
