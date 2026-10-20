<script lang="ts">
  let { title = '', class: className = '', children } = $props<{ title?: string; class?: string; children?: any }>();
</script>

<section class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm {className}">
  {#if title}
    <h2 class="text-xl font-bold mb-4 text-gray-900">{title}</h2>
  {/if}
  {@render children?.()}
</section>
