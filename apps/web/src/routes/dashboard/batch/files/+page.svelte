<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Batch = { id: string; name: string; status: 'queued'|'running'|'done'|'failed'; progress: number; createdAt: string; totalItems: number };
  let batches = $state<Batch[]>([]);
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/batch'));
    if (r.ok) batches = (await r.json()).batches ?? [];
  });
  const statusColor = { queued: 'bg-gray-200', running: 'bg-blue-500', done: 'bg-green-500', failed: 'bg-red-500' } as const;
</script>

<Card title="Batch jobs">
  {#if batches.length === 0}
    <p class="text-gray-500">No batch jobs.</p>
  {:else}
    <div class="space-y-2">
      {#each batches as b (b.id)}
        <div class="border border-gray-200 rounded p-3">
          <div class="flex items-center justify-between mb-1">
            <div class="font-medium">{b.name}</div>
            <div class="flex items-center gap-2 text-sm">
              <span class="px-2 py-0.5 rounded text-white text-xs {statusColor[b.status]}">{b.status}</span>
              <span class="text-gray-500">{b.progress}/{b.totalItems}</span>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded h-2">
            <div class="bg-blue-500 h-2 rounded" style="width: {(b.progress / Math.max(1, b.totalItems)) * 100}%"></div>
          </div>
          <div class="text-xs text-gray-500 mt-1">created {b.createdAt}</div>
        </div>
      {/each}
    </div>
  {/if}
</Card>
