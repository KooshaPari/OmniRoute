<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';

  type Provider = {
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    createdAt?: string;
  };

  let providers = $state<Provider[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let filter = $state('');

  onMount(async () => {
    try {
      const res = await fetch('http://localhost:4322/api/dashboard/providers', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        providers = j.providers ?? [];
      } else {
        error = `BFF returned ${res.status}`;
      }
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });

  const filtered = $derived(
    filter
      ? providers.filter((p) =>
          `${p.name} ${p.type} ${p.id}`.toLowerCase().includes(filter.toLowerCase())
        )
      : providers
  );
</script>

<Card title="Providers">
  <div class="flex items-center gap-3 mb-4">
    <input
      type="search"
      placeholder="Filter by name, type, id..."
      bind:value={filter}
      class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <Button>+ Add provider</Button>
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
                <button class="text-red-600 hover:underline text-sm ml-3">Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
