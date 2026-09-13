<script lang="ts">
  import { onMount } from 'svelte';

  let email = $state('');
  let submitted = $state(false);
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    // In production, this would call BFF endpoint
    await new Promise((r) => setTimeout(r, 1000));
    submitted = true;
    loading = false;
  }
</script>

<svelte:head>
  <title>Forgot Password - OmniRoute</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <a href="/" class="text-2xl font-bold" style="color: var(--color-primary, #4f46e5)">OmniRoute</a>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      {#if submitted}
        <div class="text-center">
          <div class="text-4xl mb-4">📧</div>
          <h1 class="text-xl font-bold mb-2">Check your email</h1>
          <p class="text-gray-600 text-sm mb-6">
            If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
          </p>
          <a href="/login" class="text-sm text-indigo-600 hover:underline">
            Back to sign in
          </a>
        </div>
      {:else}
        <h1 class="text-xl font-bold mb-2">Reset your password</h1>
        <p class="text-gray-600 text-sm mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form onsubmit={handleSubmit} class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              placeholder="you@example.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-2 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-medium"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p class="text-center text-sm text-gray-600 mt-6">
          <a href="/login" class="text-indigo-600 hover:underline">Back to sign in</a>
        </p>
      {/if}
    </div>
  </div>
</div>
