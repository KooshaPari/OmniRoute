<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let trafficSplit = $state(50); // 0-100, percent to slot A
  let slotA = $state({ model: 'claude-sonnet-4', notes: '' });
  let slotB = $state({ model: 'gpt-4o', notes: '' });

  const slotAPct = $derived(trafficSplit);
  const slotBPct = $derived(100 - trafficSplit);
</script>

<Card title="A/B test">
  <p class="text-sm text-gray-600 mb-4">Compare two parallel configs head-to-head. Traffic is split deterministically by header hash.</p>

  <div class="space-y-4">
    <div>
      <label for="ab-traffic-split" class="text-sm font-medium text-gray-700">Traffic split: {slotAPct}% / {slotBPct}%</label>
      <input id="ab-traffic-split" type="range" min="0" max="100" bind:value={trafficSplit} class="w-full" />
      <div class="flex justify-between text-xs text-gray-500">
        <span>Slot A: {slotAPct}%</span>
        <span>Slot B: {slotBPct}%</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="border border-blue-200 rounded p-3 bg-blue-50/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-blue-700">Slot A ({slotAPct}%)</span>
        </div>
        <input bind:value={slotA.model} placeholder="model id" class="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono mb-2" />
        <textarea bind:value={slotA.notes} placeholder="notes (e.g. hypothesis)" rows="2" class="w-full px-2 py-1 border border-gray-300 rounded text-xs"></textarea>
      </div>
      <div class="border border-green-200 rounded p-3 bg-green-50/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-green-700">Slot B ({slotBPct}%)</span>
        </div>
        <input bind:value={slotB.model} placeholder="model id" class="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono mb-2" />
        <textarea bind:value={slotB.notes} placeholder="notes (e.g. control)" rows="2" class="w-full px-2 py-1 border border-gray-300 rounded text-xs"></textarea>
      </div>
    </div>

    <div class="text-xs text-gray-500">
      A/B test stays inert until you enable it for the combo. Performance is compared in the Performance panel.
    </div>
  </div>
</Card>
