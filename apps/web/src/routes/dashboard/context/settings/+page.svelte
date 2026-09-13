<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';

  let settings = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/context/settings'));
      if (res.ok) settings = await res.json();
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });

  async function save() {
    if (!settings) return;
    saving = true;
    try {
      await fetch(bffApiUrl('/api/dashboard/context/settings'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (err) {
      error = `Save failed: ${(err as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Card title="Context Settings">
  <p class="text-sm text-gray-600 mb-4">Global defaults for compression pipeline. Per-mode overrides live on each mode page.</p>

  {#if loading}
    <p class="text-gray-500">Loading settings...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
    <Button variant="primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Default Mode</label>
        <select bind:value={settings.defaultMode} class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
          <option value="lite">Lite</option>
          <option value="standard">Standard</option>
          <option value="aggressive">Aggressive</option>
          <option value="ultra">Ultra</option>
          <option value="caveman">Caveman</option>
          <option value="rtk">RTK</option>
          <option value="llmlingua">LLMLingua</option>
          <option value="omniglyph">Omniglyph</option>
          <option value="ccr">CCR</option>
          <option value="headroom">Headroom</option>
          <option value="session-dedup">Session Dedup</option>
          <option value="combos">Combos</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Auto Trigger Threshold</label>
        <input type="range" bind:value={settings.autoTriggerThreshold} min="0" max="1" step="0.05" class="w-full md:w-64">
        <p class="text-sm text-gray-500 mt-1">{(settings.autoTriggerThreshold * 100).toFixed(0)}% token budget used</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Max Tokens Before Compress</label>
        <input type="number" bind:value={settings.maxTokensBeforeCompress} min="1000" max="200000" step="1000" class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
      </div>

      <div class="flex items-center gap-3">
        <input type="checkbox" id="stacked" bind:checked={settings.enableStackedPipelines} class="w-4 h-4">
        <label for="stacked" class="text-sm text-gray-700">Enable Stacked Pipelines</label>
      </div>

      <div class="flex items-center gap-3">
        <input type="checkbox" id="fallback" bind:checked={settings.enableFallback} class="w-4 h-4">
        <label for="fallback" class="text-sm text-gray-700">Enable Fallback Mode</label>
      </div>

      <div class="pt-4 border-t">
        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
        <Button type="button" variant="secondary" onclick={() => (window.location.href = '/dashboard/context')}>← Back</Button>
      </div>
    </form>
  {/if}
</Card>