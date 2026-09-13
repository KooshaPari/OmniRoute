<svelte:head>
  <title>Offline - OmniRoute</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="text-center max-w-md">
    <div class="text-5xl mb-6">📡</div>
    <h1 class="text-2xl font-bold mb-3">You're offline</h1>
    <p class="text-gray-600 mb-6">
      Please check your internet connection and try again.
    </p>
    <button
      onclick={() => window.location.reload()}
      class="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
    >
      Try again
    </button>
  </div>
</div>
