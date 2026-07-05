<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<main class="min-h-screen bg-[var(--color-surface)]">
  <header class="border-b border-gray-200 p-4">
    <h1 class="text-2xl font-bold" style="color: var(--color-primary)">OmniRoute v4</h1>
    <p class="text-sm text-gray-500">Svelte 5 + SvelteKit 2 + Hono 4 + Tauri 2</p>
  </header>
  {@render children()}
</main>
