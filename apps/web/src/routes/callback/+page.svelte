<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Card from '$lib/components/ui/Card.svelte';

  let status = $state<'pending' | 'success' | 'error'>('pending');
  let message = $state('Processing OAuth callback...');

  onMount(async () => {
    const params = $page.url.searchParams;
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      status = 'error';
      message = `OAuth error: ${error}`;
      return;
    }

    if (!code) {
      status = 'error';
      message = 'No OAuth code in callback URL';
      return;
    }

    try {
      const res = await fetch('http://localhost:4322/api/v1/auth/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, state }),
      });
      if (res.ok) {
        status = 'success';
        message = 'OAuth successful. Redirecting to dashboard...';
        setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
      } else {
        status = 'error';
        message = `Callback failed: ${res.status}`;
      }
    } catch (err) {
      status = 'error';
      message = `Network error: ${(err as Error).message}`;
    }
  });
</script>

<Card title="OAuth Callback">
  {#if status === 'pending'}
    <p class="text-gray-600">{message}</p>
  {:else if status === 'success'}
    <p class="text-green-600">{message}</p>
  {:else}
    <p class="text-red-600">{message}</p>
  {/if}
</Card>
