<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let events = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/audit/mcp'), { credentials: 'include' });
      if (res.ok) events = (await res.json()).items ?? [];
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>MCP Audit - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">MCP Audit Log</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if events.length === 0}
    <div class="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      No MCP audit events recorded.
    </div>
  {:else}
    <div class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/50">
            <th class="text-left p-3">Timestamp</th>
            <th class="text-left p-3">Server</th>
            <th class="text-left p-3">Tool</th>
            <th class="text-left p-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {#each events as event (event.id ?? event.timestamp)}
            <tr class="border-b last:border-b-0">
              <td class="p-3 text-muted-foreground">{event.timestamp ?? '—'}</td>
              <td class="p-3 font-medium">{event.server ?? '—'}</td>
              <td class="p-3 font-mono text-xs">{event.tool ?? '—'}</td>
              <td class="p-3">
                <span class={event.result === 'success' ? 'text-green-600' : 'text-red-500'}>
                  {event.result ?? '—'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
