<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let preview = $state<any>(null);
  let input = $state('Sample text for compression preview. This text will be compressed by the selected engine to demonstrate token savings.');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let mode = $derived($page.params.mode ?? '');

  async function runPreview() {
    if (!input.trim()) return;
    loading = true;
    error = null;
    try {
      const res = await fetch(bffApiUrl(`/api/dashboard/context/${mode}/preview?text=${encodeURIComponent(input)}`));
      if (res.ok) preview = await res.json();
      else error = `HTTP ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  onMount(runPreview);
</script>

<Card title="{mode} Preview">
  <p class="text-sm text-gray-600 mb-4">Test compression on custom text with the {mode} engine.</p>

  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Input Text</label>
      <textarea bind:value={input} rows="6" class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm" placeholder="Enter text to compress..."></textarea>
    </div>

    <Button variant="primary" onclick={runPreview} disabled={loading}>{loading ? 'Compressing…' : 'Run Preview'}</Button>

    {#if error}
      <p class="text-red-600">{error}</p>
    {:else if preview}
      <div class="space-y-3">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div class="p-3 bg-gray-50 rounded-lg"><p class="text-gray-500">Original Tokens</p><p class="font-bold">{preview.originalTokens}</p></div>
          <div class="p-3 bg-gray-50 rounded-lg"><p class="text-gray-500">Compressed Tokens</p><p class="font-bold">{preview.compressedTokens}</p></div>
          <div class="p-3 bg-gray-50 rounded-lg"><p class="text-gray-500">Savings</p><p class="font-bold">{preview.savingsPct}%</p></div>
          <div class="p-3 bg-gray-50 rounded-lg"><p class="text-gray-500">Latency</p><p class="font-bold">{preview.latencyMs}ms</p></div>
        </div>

        <div class="border border-gray-200 rounded p-3 bg-gray-50">
          <p class="text-sm font-medium text-gray-700 mb-1">Compressed Output</p>
          <pre class="text-xs overflow-x-auto whitespace-pre-wrap font-mono text-gray-900">{preview.compressed}</pre>
        </div>
      </div>
    {/if}
  </div>
</Card>