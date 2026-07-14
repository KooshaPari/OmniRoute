<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Memory = { id: string; key: string; value: string; updatedAt: string; scope: 'global'|'user'|'session' };
  let entries = $state<Memory[]>([]);
  let scope = $state<'all' | 'global' | 'user' | 'session'>('all');
  onMount(async () => {
    const r = await fetch('http://localhost:4322/api/dashboard/memory');
    if (r.ok) entries = (await r.json()).entries ?? [];
  });
  const filtered = $derived(scope === 'all' ? entries : entries.filter((e) => e.scope === scope));
</script>

<Card title="Memory store">
  <p class="text-sm text-gray-600 mb-4">Cross-conversation memory entries used by agents. KV storage with TTL.</p>
  <div class="flex items-center gap-2 mb-3">
    <label for="memory-scope" class="text-sm">Scope:</label>
    <select id="memory-scope" bind:value={scope} class="px-2 py-1 border border-gray-300 rounded text-sm">
      <option value="all">all</option>
      <option value="global">global</option>
      <option value="user">user</option>
      <option value="session">session</option>
    </select>
  </div>
  {#if filtered.length === 0}
    <p class="text-gray-500">No memory entries.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr><th class="text-left px-3 py-2 font-semibold">Key</th><th class="text-left px-3 py-2 font-semibold">Scope</th><th class="text-left px-3 py-2 font-semibold">Value</th><th class="text-left px-3 py-2 font-semibold">Updated</th></tr>
      </thead>
      <tbody>
        {#each filtered as e (e.id)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 font-mono">{e.key}</td>
            <td class="px-3 py-2">{e.scope}</td>
            <td class="px-3 py-2 truncate max-w-md">{e.value}</td>
            <td class="px-3 py-2 text-gray-500">{e.updatedAt}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
