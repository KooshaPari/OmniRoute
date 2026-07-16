<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';

  type Bucket = { id: string; label: string; cap: number; unit: 'req/min' | 'req/hour' | 'req/day' | 'tokens/min'; used: number; overflow: 'block' | 'queue' | 'fallback' };

  let buckets = $state<Bucket[]>([
    { id: crypto.randomUUID(), label: 'Default tier', cap: 60, unit: 'req/min', used: 0, overflow: 'fallback' },
    { id: crypto.randomUUID(), label: 'Pro tier', cap: 600, unit: 'req/min', used: 0, overflow: 'queue' },
  ]);

  function add() {
    buckets = [...buckets, { id: crypto.randomUUID(), label: 'New bucket', cap: 100, unit: 'req/min', used: 0, overflow: 'block' }];
  }
  function remove(id: string) {
    buckets = buckets.filter((b) => b.id !== id);
  }
  function moveUp(idx: number) {
    if (idx === 0) return;
    [buckets[idx - 1], buckets[idx]] = [buckets[idx], buckets[idx - 1]];
    buckets = [...buckets];
  }
  function moveDown(idx: number) {
    if (idx >= buckets.length - 1) return;
    [buckets[idx], buckets[idx + 1]] = [buckets[idx + 1], buckets[idx]];
    buckets = [...buckets];
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <p class="text-sm text-gray-600">Bucket caps are evaluated in order. First match by label wins.</p>
    <Button onclick={add}>+ Add bucket</Button>
  </div>

  {#if buckets.length === 0}
    <p class="text-gray-500 text-sm">No buckets. All traffic uses the default chain.</p>
  {:else}
    <ol class="space-y-2">
      {#each buckets as b, i (b.id)}
        <li class="border border-purple-200 rounded p-3 bg-purple-50/30">
          <div class="flex items-center gap-2">
            <span class="text-purple-400 font-mono text-sm w-6 text-right">{i + 1}</span>
            <input bind:value={b.label} placeholder="bucket label (e.g. 'Pro tier')" class="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
            <input type="number" min="0" bind:value={b.cap} class="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
            <select bind:value={b.unit} class="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="req/min">req/min</option>
              <option value="req/hour">req/hour</option>
              <option value="req/day">req/day</option>
              <option value="tokens/min">tokens/min</option>
            </select>
            <select bind:value={b.overflow} class="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="block">block</option>
              <option value="queue">queue</option>
              <option value="fallback">fallback</option>
            </select>
            <button class="text-gray-500 hover:bg-gray-100 px-2 rounded text-sm" onclick={() => moveUp(i)}>↑</button>
            <button class="text-gray-500 hover:bg-gray-100 px-2 rounded text-sm" onclick={() => moveDown(i)}>↓</button>
            <button class="text-red-500 hover:bg-red-50 px-2 rounded text-sm" onclick={() => remove(b.id)}>×</button>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>
