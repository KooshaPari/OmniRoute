<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let agent = $state<{ id: string; name: string } | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    const id = $page.params.id;
    if (!id) { error = 'Missing id'; loading = false; return; }
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/agents/cli-code/${id}`));
      if (r.ok) { agent = await r.json(); error = null; }
      else error = `HTTP ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });
</script>

<Card title="CLI Code Agent Details">
  {#if loading}
    <p class="text-gray-500">Loading agent...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if !agent}
    <p class="text-gray-500">Agent not found.</p>
  {:else}
    <p><span class="font-medium">ID:</span> {agent.id}</p>
    <p><span class="font-medium">Name:</span> {agent.name}</p>
  {/if}
</Card>
