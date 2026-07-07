<script lang="ts">
  let { children } = $props();
</script>

<main class="h-screen overflow-hidden bg-base-100 text-base-content">
  {@render children?.()}
</main>
