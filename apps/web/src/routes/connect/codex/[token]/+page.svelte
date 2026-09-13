<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let token = $derived($page.params.token);
  let status = $state('connecting');

  onMount(() => {
    // Deep link handler: parse token and redirect to app
    if (token) {
      status = 'connected';
      // In production, validate token and redirect to Codex integration
    }
  });
</script>

<svelte:head>
  <title>Connect to Codex - OmniRoute</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="text-center max-w-md">
    {#if status === 'connecting'}
      <div class="text-4xl mb-4">⏳</div>
      <h1 class="text-xl font-bold mb-2">Connecting to Codex...</h1>
      <p class="text-gray-600 text-sm">Validating your connection token.</p>
    {:else}
      <div class="text-4xl mb-4">✅</div>
      <h1 class="text-xl font-bold mb-2">Connected</h1>
      <p class="text-gray-600 text-sm mb-4">You've been connected to Codex via OmniRoute.</p>
      <a href="/dashboard" class="text-sm text-indigo-600 hover:underline">Go to Dashboard</a>
    {/if}
  </div>
</div>
