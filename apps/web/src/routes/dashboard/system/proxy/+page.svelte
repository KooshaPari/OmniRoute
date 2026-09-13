<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import { onMount } from 'svelte';

  let config = $state<Record<string, unknown>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/system/proxy'), { credentials: 'include' });
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
  <title>Proxy Configuration - OmniRoute</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Proxy Configuration</h1>

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
        <span class="font-medium">Upstream</span>
        <span class="font-mono text-sm">{config.upstream || '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Timeout</span>
        <span>{config.timeout ?? '—'}s</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Retries</span>
        <span>{config.retries ?? '—'}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="font-medium">Health Check</span>
        <span>{config.healthCheck ? 'Enabled' : 'Disabled'}</span>
      </div>
    </div>
  {/if}
</div>
