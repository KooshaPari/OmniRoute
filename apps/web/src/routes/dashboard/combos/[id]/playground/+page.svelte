<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type PlaygroundData = {
    availableProviders: string[];
    testModels: Record<string, string[]>;
    defaultSettings: {
      strategy: string;
      timeoutMs: number;
      maxRetries: number;
      enableFallback: boolean;
    };
    samplePrompt: string;
  };

  let data = $state<PlaygroundData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let id = $derived($page.params.id ?? '');

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl(`/api/dashboard/combos/${id}/playground`));
      if (res.ok) data = await res.json();
      else error = `HTTP ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<Card title="{id} Playground">
  <p class="text-sm text-gray-600 mb-4">Experiment with combo configurations and test routing strategies.</p>

  {#if loading}
    <p class="text-gray-500">Loading playground...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if data}
    <div class="space-y-6">
      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Available Providers</h3>
        <div class="flex flex-wrap gap-2">
          {#each data.availableProviders as p}
            <span class="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{p}</span>
          {/each}
        </div>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Test Models</h3>
        <div class="space-y-3">
          {#each Object.entries(data.testModels) as [provider, models]}
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">{provider}</p>
              <div class="flex flex-wrap gap-2">
                {#each models as m}
                  <span class="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono">{m}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Default Settings</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Strategy</p>
            <p class="font-mono">{data.defaultSettings.strategy}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Timeout</p>
            <p class="font-mono">{data.defaultSettings.timeoutMs}ms</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Max Retries</p>
            <p class="font-mono">{data.defaultSettings.maxRetries}</p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Fallback</p>
            <p class="font-mono">{data.defaultSettings.enableFallback ? 'On' : 'Off'}</p>
          </div>
        </div>
      </div>

      <div class="border-t pt-4">
        <h3 class="font-semibold mb-3">Sample Prompt</h3>
        <pre class="p-3 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap">{data.samplePrompt}</pre>
      </div>
    </div>
  {/if}
</Card>