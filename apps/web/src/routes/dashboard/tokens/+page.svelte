<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let tokens = $state<{ id: string; name: string; prefix: string; last4: string }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/tokens'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { tokens = d.tokens ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Tokens">
  {#if loading}
    <p class="text-gray-500">Loading tokens...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    {#if tokens.length === 0}
      <p class="text-gray-500">No tokens found.</p>
    {:else}
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b">
            <th class="py-1">Name</th>
            <th class="py-1">Prefix</th>
            <th class="py-1">Last 4</th>
          </tr>
        </thead>
        <tbody>
          {#each tokens as t (t.id)}
            <tr class="border-b">
              <td class="py-2">{t.name}</td>
              <td class="py-2 text-gray-500">{t.prefix}</td>
              <td class="py-2">{t.last4}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</Card>
