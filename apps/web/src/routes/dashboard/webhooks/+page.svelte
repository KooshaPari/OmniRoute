<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  type Webhook = { id: string; url: string; events: string[]; enabled: boolean; lastDelivery: string | null; lastStatus: number | null };
  let webhooks = $state<Webhook[]>([]);
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/webhooks'));
    if (r.ok) webhooks = (await r.json()).webhooks ?? [];
  });
</script>

<Card title="Webhooks">
  <div class="flex justify-end mb-4"><Button>+ Add webhook</Button></div>
  {#if webhooks.length === 0}
    <p class="text-gray-500">No webhooks configured.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr><th class="text-left px-3 py-2 font-semibold">URL</th><th class="text-left px-3 py-2 font-semibold">Events</th><th class="text-left px-3 py-2 font-semibold">Last delivery</th><th class="text-left px-3 py-2 font-semibold">Status</th></tr>
      </thead>
      <tbody>
        {#each webhooks as w (w.id)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-mono text-xs break-all">{w.url}</td>
            <td class="px-3 py-2 text-xs">{w.events.join(', ')}</td>
            <td class="px-3 py-2 text-gray-500">{w.lastDelivery ?? 'never'}</td>
            <td class="px-3 py-2">
              {#if w.lastStatus}
                <span class="px-2 py-0.5 rounded text-xs {w.lastStatus < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">{w.lastStatus}</span>
              {:else}
                <span class="text-gray-400 text-xs">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
