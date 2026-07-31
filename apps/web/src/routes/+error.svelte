<script lang="ts">
  import { page } from '$app/stores';

  const isNotFound = $derived($page.status === 404);

  function retry(): void {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>{isNotFound ? 'Page not found' : 'Unable to load page'} | argismonitor</title>
</svelte:head>

<section class="mx-auto max-w-xl py-16" aria-labelledby="route-error-title">
  <p class="text-sm font-semibold uppercase tracking-wide text-indigo-700">{$page.status}</p>
  <h1 id="route-error-title" class="mt-2 text-3xl font-bold text-gray-950">
    {isNotFound ? 'Page not found' : 'Unable to load this page'}
  </h1>
  <p class="mt-3 text-gray-700">
    {isNotFound
      ? 'The address may be outdated or the page may have moved.'
      : 'The application could not render this route. Retry the request or return to the home view.'}
  </p>
  <div class="mt-6 flex flex-wrap gap-3">
    <a href="/home" class="rounded bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
      Go to home
    </a>
    {#if !isNotFound}
      <button class="rounded border border-gray-300 px-4 py-2 font-semibold text-gray-900 hover:bg-gray-50" onclick={retry}>
        Retry
      </button>
    {/if}
  </div>
</section>
