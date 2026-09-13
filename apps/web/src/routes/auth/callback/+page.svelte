<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let status = $state('processing');
  let error = $state<string | null>(null);

  onMount(() => {
    const code = $page.url.searchParams.get('code');
    const state = $page.url.searchParams.get('state');

    if (!code) {
      error = 'No authorization code received.';
      status = 'error';
      return;
    }

    // In production, exchange code for token via BFF
    status = 'success';
  });
</script>

<svelte:head>
  <title>Authenticating - OmniRoute</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="text-center max-w-md">
    {#if status === 'processing'}
      <div class="text-4xl mb-4">⏳</div>
      <h1 class="text-xl font-bold mb-2">Authenticating...</h1>
      <p class="text-gray-600 text-sm">Processing your login credentials.</p>
    {:else if status === 'error'}
      <div class="text-4xl mb-4">❌</div>
      <h1 class="text-xl font-bold mb-2">Authentication failed</h1>
      <p class="text-gray-600 text-sm mb-4">{error}</p>
      <a href="/login" class="text-sm text-indigo-600 hover:underline">Try again</a>
    {:else}
      <div class="text-4xl mb-4">✅</div>
      <h1 class="text-xl font-bold mb-2">Authenticated</h1>
      <p class="text-gray-600 text-sm mb-4">Redirecting to your dashboard...</p>
      <a href="/dashboard" class="text-sm text-indigo-600 hover:underline">Go to Dashboard</a>
    {/if}
  </div>
</div>
