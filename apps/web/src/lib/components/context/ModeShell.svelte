<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { bffApiUrl } from '$lib/bff-origin';
  import { page } from '$app/stores';

  type Mode = {
    id: string;
    name: string;
    description: string;
    color: string;
  };

  let mode = $derived($page.params.mode ?? '');
</script>

<Card title={`Context: ${mode}`}>
  <p class="text-sm text-gray-600 mb-4">Mode-specific configuration and stats.</p>
  <div class="flex gap-3 mb-4">
    <Button variant="secondary" onclick={() => (window.location.href = `/dashboard/context`)}>← All Modes</Button>
    <Button variant="primary" onclick={() => (window.location.href = `/dashboard/context/${mode}/stats`)}>Live Stats</Button>
    <Button variant="secondary" onclick={() => (window.location.href = `/dashboard/context/${mode}/preview`)}>Preview</Button>
  </div>
  <p class="text-sm text-gray-500">Mode: <code class="bg-gray-100 px-1 rounded">{mode}</code></p>
</Card>