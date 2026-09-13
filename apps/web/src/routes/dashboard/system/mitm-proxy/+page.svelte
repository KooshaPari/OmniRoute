<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let config = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/system/mitm-proxy'), { credentials: 'include' });
      if (res.ok) config = (await res.json()).config ?? {};
      else error = `BFF returned ${res.status}`;
    } catch (err) {
      error = `BFF unreachable: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>MITM Proxy - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">MITM Proxy</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading...</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else}
    <div class="rounded-lg border bg-card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <span class="font-medium">Enabled</span>
        <span class={config.enabled ? 'text-green-600' : 'text-muted-foreground'}>
          {config.enabled ? 'Yes' : 'No'}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Port</span>
        <span>{config.port ?? '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">TLS Interception</span>
        <span>{config.interceptTls ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Log Requests</span>
        <span>{config.logRequests ? 'Yes' : 'No'}</span>
      </div>
    </div>
  {/if}
</div>
