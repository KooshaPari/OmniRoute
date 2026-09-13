<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let services = $state<{ id: string; name: string; providerId: string }[]>([]);
  let loading = $state(true);
  let providerId = $state('');
  let error = $state<string | null>(null);

  onMount(async () => {
    providerId = $page.params.id ?? '';
    if (!providerId) { loading = false; return; }
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/providers/services/${providerId}`));
      if (r.ok) { const d = await r.json(); services = d.services ?? []; error = null; }
      else error = `HTTP ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<Card title="Provider Services">
  {#if loading}
    <p class="text-gray-500">Loading services...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if services.length === 0}
      <p class="text-gray-500">No services found for provider {providerId}.</p>
    {:else}
      <ul class="space-y-2">
        {#each services as s (s.id)}
          <li class="flex items-center justify-between border-b py-2">
            <span class="font-medium">{s.name}</span>
            <span class="text-sm text-gray-500">{s.id}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
