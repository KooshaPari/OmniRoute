<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let traffic = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/tools/traffic-inspector'), { credentials: 'include' });
      if (res.ok) traffic = (await res.json()).items ?? [];
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Traffic Inspector - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Traffic Inspector</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if traffic.length === 0}
    <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      No traffic data captured yet.
    </div>
  {:else}
    <div class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50">
            <th class="text-left p-3">Timestamp</th>
            <th class="text-left p-3">Method</th>
            <th class="text-left p-3">Path</th>
            <th class="text-left p-3">Status</th>
            <th class="text-left p-3">Latency</th>
          </tr>
        </thead>
        <tbody>
          {#each traffic as entry (entry.id ?? entry.timestamp)}
            <tr class="border-b last:border-b-0">
              <td class="p-3 text-muted-foreground">{entry.timestamp ?? '—'}</td>
              <td class="p-3 font-mono text-xs">{entry.method ?? '—'}</td>
              <td class="p-3 font-mono text-xs">{entry.path ?? '—'}</td>
              <td class="p-3">
                <span class={entry.status < 400 ? 'text-green-600' : 'text-red-500'}>
                  {entry.status ?? '—'}
                </span>
              </td>
              <td class="p-3 text-muted-foreground">{entry.latency ?? '—'}ms</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
