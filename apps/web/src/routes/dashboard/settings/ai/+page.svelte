<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let provider = $state('openai');
  let model = $state('gpt-4o');
  let temperature = $state(0.7);
  let maxTokens = $state(4096);
  let streaming = $state(true);
  let systemPrompt = $state('');
  let embedModel = $state('text-embedding-3-small');
  let embedDims = $state(1536);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/ai'))
      .then(r => r.json())
      .then(d => {
        provider = d.defaultProvider; model = d.defaultModel;
        temperature = d.temperature; maxTokens = d.maxTokens;
        streaming = d.streamingEnabled; systemPrompt = d.systemPrompt;
        embedModel = d.embeddingModel; embedDims = d.embeddingDimensions;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/ai'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultProvider: provider, defaultModel: model,
          temperature, maxTokens, streamingEnabled: streaming, systemPrompt,
          embeddingModel: embedModel, embeddingDimensions: embedDims }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="AI / LLM settings">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Default provider</label>
        <select bind:value={provider} class="w-full px-3 py-2 border border-gray-300 rounded">
          <option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>
          <option value="google">Google</option><option value="azure">Azure</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Default model</label>
        <input type="text" bind:value={model} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
          <input type="number" bind:value={temperature} min={0} max={2} step={0.1} class="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Max tokens</label>
          <input type="number" bind:value={maxTokens} min={256} max={128000} class="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input id="streaming" type="checkbox" bind:checked={streaming} class="rounded" />
        <label for="streaming" class="text-sm text-gray-700">Enable streaming responses</label>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">System prompt</label>
        <textarea bind:value={systemPrompt} rows={4} class="w-full px-3 py-2 border border-gray-300 rounded" placeholder="Default system prompt..."></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Embedding model</label>
          <input type="text" bind:value={embedModel} class="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Embedding dimensions</label>
          <input type="number" bind:value={embedDims} min={128} max={3072} class="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
