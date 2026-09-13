<script lang="ts">
  import { onMount } from 'svelte';

  const categories = [
    { name: 'Getting Started', slug: 'getting-started', description: 'Quick start guides and setup tutorials.' },
    { name: 'Providers', slug: 'providers', description: 'Configure and manage AI model providers.' },
    { name: 'Routing', slug: 'routing', description: 'Set up intelligent routing rules.' },
    { name: 'Cost Management', slug: 'cost-management', description: 'Budgets, alerts, and usage tracking.' },
    { name: 'API Reference', slug: 'api-reference', description: 'Complete API documentation.' },
    { name: 'Security', slug: 'security', description: 'Authentication, keys, and access control.' },
  ];

  let searchQuery = $state('');
  let filtered = $derived(
    searchQuery
      ? categories.filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : categories
  );
</script>

<svelte:head>
  <title>Documentation - OmniRoute</title>
  <meta name="description" content="OmniRoute documentation and guides." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-2">Documentation</h1>
  <p class="text-gray-600 mb-8">Guides, tutorials, and API reference for OmniRoute.</p>

  <!-- Search -->
  <div class="mb-8">
    <input
      type="search"
      placeholder="Search documentation..."
      bind:value={searchQuery}
      class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>

  <!-- Categories -->
  <div class="grid sm:grid-cols-2 gap-4">
    {#each filtered as category}
      <a
        href="/docs/{category.slug}"
        class="block p-5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
      >
        <h2 class="text-lg font-semibold mb-1">{category.name}</h2>
        <p class="text-sm text-gray-600">{category.description}</p>
      </a>
    {/each}
  </div>

  {#if filtered.length === 0}
    <p class="text-center text-gray-500 mt-8">No results found for "{searchQuery}"</p>
  {/if}
</div>
