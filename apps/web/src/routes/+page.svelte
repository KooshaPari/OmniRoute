<script lang="ts">
  let count = $state(0);
</script>

<section class="p-8">
  <h2 class="text-3xl font-bold mb-4">Welcome to OmniRoute v4</h2>
  <p class="text-gray-700 mb-4">Svelte 5 runes are live. Click the button:</p>
  <button
    class="px-4 py-2 rounded text-white font-semibold"
    style="background: var(--grad-brand)"
    onclick={() => count++}
  >
    Count: {count}
  </button>
</section>
