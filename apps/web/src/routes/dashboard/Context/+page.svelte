<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';

  type Mode = {
    id: string;
    name: string;
    description: string;
    color: string;
  };

  let modes = $state<Mode[]>([]);
  let settings = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const [modesRes, settingsRes] = await Promise.all([
        fetch(bffApiUrl('/api/dashboard/context')),
        fetch(bffApiUrl('/api/dashboard/context/settings')),
      ]);
      if (modesRes.ok) modes = (await modesRes.json()).modes ?? [];
      if (settingsRes.ok) settings = await settingsRes.json();
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<Card title="Context & Compression Modes">
  <p class="text-sm text-gray-600 mb-4">12 compression modes for prompt optimization. Configure defaults and explore each mode.</p>

  {#if loading}
    <p class="text-gray-500">Loading modes...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <h3 class="font-semibold mb-2">Global Settings</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><span class="text-gray-500">Default Mode:</span> <span class="font-mono ml-2">{settings?.defaultMode ?? '—'}</span></div>
        <div><span class="text-gray-500">Auto Trigger:</span> <span class="font-mono ml-2">{(settings?.autoTriggerThreshold ?? 0) * 100}%</span></div>
        <div><span class="text-gray-500">Max Tokens:</span> <span class="font-mono ml-2">{settings?.maxTokensBeforeCompress ?? '—'}</span></div>
        <div><span class="text-gray-500">Stacked:</span> <span class="font-mono ml-2">{settings?.enableStackedPipelines ? 'On' : 'Off'}</span></div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each modes as m (m.id)}
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <div class="flex items-center justify-between mb-2">
            <span class={`px-2 py-1 text-xs font-medium rounded-full ${m.color}`}>{m.name}</span>
          </div>
          <p class="text-sm text-gray-600 mb-3">{m.description}</p>
          <div class="flex gap-2">
            <Button size="sm" variant="primary" onclick={() => (window.location.href = `/dashboard/context/${m.id}`)}>Config</Button>
            <Button size="sm" variant="secondary" onclick={() => (window.location.href = `/dashboard/context/${m.id}/stats`)}>Stats</Button>
            <Button size="sm" variant="ghost" onclick={() => (window.location.href = `/dashboard/context/${m.id}/preview`)}>Preview</Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>