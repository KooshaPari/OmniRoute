<script lang="ts">
  let { title = '', children } = $props<{ title?: string; children?: any }>();
</script>

<section class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
  {#if title}
    <h2 class="text-xl font-bold mb-4 text-gray-900">{title}</h2>
  {/if}
  {@render children?.()}
</section>
