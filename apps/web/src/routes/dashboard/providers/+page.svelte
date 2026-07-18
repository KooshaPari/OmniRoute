<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { trpc } from '$lib/trpc/client';

  let providers = $state<{ id: string; name: string; type: string; createdAt?: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let filter = $state('');

  async function refresh() {
    try {
      providers = (await trpc.providers.list.query()) as typeof providers;
      error = null;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }
  $effect(() => { refresh(); });

  const filtered = $derived(
    filter
      ? providers.filter((p) => `${p.name} ${p.type} ${p.id}`.toLowerCase().includes(filter.toLowerCase()))
      : providers
  );

  async function add() {
    const name = prompt('Provider name?'); if (!name) return;
    const type = (prompt('Type? openai|anthropic|gemini|mistral|cohere|openrouter|custom') ?? 'openai') as 'openai';
    await trpc.providers.create.mutate({ id: crypto.randomUUID(), name, type, config: {} });
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm(`Delete provider ${id}?`)) return;
    await trpc.providers.delete.mutate({ id });
    await refresh();
  }
</script>

<Card title="Providers (tRPC)">
  <div class="flex items-center gap-3 mb-4">
    <input
      type="search"
      placeholder="Filter by name, type, id..."
      bind:value={filter}
      class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <Button onclick={add}>+ Add provider</Button>
    <Button variant="secondary" onclick={refresh}>Refresh</Button>
  </div>

  {#if loading}
    <p class="text-gray-500">Loading providers from BFF...</p>
  {:else if error}
    <p class="text-red-600 text-sm">{error}</p>
  {:else if filtered.length === 0}
    <p class="text-gray-500">No providers yet. Add one to get started.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-3 py-2 font-semibold">Name</th>
            <th class="text-left px-3 py-2 font-semibold">Type</th>
            <th class="text-left px-3 py-2 font-semibold">ID</th>
            <th class="text-left px-3 py-2 font-semibold">Created</th>
            <th class="text-right px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as p (p.id)}
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-3 py-2 font-medium">{p.name}</td>
              <td class="px-3 py-2 text-gray-600">{p.type}</td>
              <td class="px-3 py-2 text-gray-500 font-mono text-xs">{p.id}</td>
              <td class="px-3 py-2 text-gray-500">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
              <td class="px-3 py-2 text-right">
                <button class="text-blue-600 hover:underline text-sm">Edit</button>
                <button class="text-red-600 hover:underline text-sm ml-3" onclick={() => remove(p.id)}>Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
