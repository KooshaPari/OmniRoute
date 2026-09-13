<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let bridges = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/tools/agent-bridge'), { credentials: 'include' });
      if (res.ok) bridges = (await res.json()).items ?? [];
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Agent Bridge - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Agent Bridge</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if bridges.length === 0}
    <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      No agent bridge connections configured.
    </div>
  {:else}
    <div class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50">
            <th class="text-left p-3">Name</th>
            <th class="text-left p-3">Status</th>
            <th class="text-left p-3">Last Sync</th>
          </tr>
        </thead>
        <tbody>
          {#each bridges as bridge (bridge.id ?? bridge.name)}
            <tr class="border-b last:border-b-0">
              <td class="p-3 font-medium">{bridge.name}</td>
              <td class="p-3">
                <span class={bridge.status === 'connected' ? 'text-green-600' : 'text-muted-foreground'}>
                  {bridge.status ?? 'unknown'}
                </span>
              </td>
              <td class="p-3 text-muted-foreground">{bridge.lastSync ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
