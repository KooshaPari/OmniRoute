<script lang="ts">
  import { page } from '$app/stores';

  let slug = $derived($page.params.slug);
  let title = $derived(slug ? slug.split('/').map((s: string) => s.replace(/-/g, ' ')).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ') : 'Documentation');
</script>

<svelte:head>
  <title>{title} - OmniRoute Docs</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <nav class="text-sm text-gray-500 mb-6">
    <a href="/docs" class="hover:text-indigo-600">Docs</a>
    <span class="mx-1">/</span>
    <span class="text-gray-800">{title}</span>
  </nav>

  <article class="prose prose-gray max-w-none">
    <h1>{title}</h1>

    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-6">
      <strong>Note:</strong> This documentation page is a placeholder. Content will be populated from the docs CMS.
    </div>

    <p>
      Documentation for <strong>{title}</strong> is coming soon.
      Check back later or visit our
      <a href="/docs">documentation hub</a> for other topics.
    </p>
  </article>
</div>
