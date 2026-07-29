<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { dashboardConnectionStatus } from '$lib/dashboard/home-status';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const quickLinks = [
    {
      href: '/dashboard/providers',
      title: 'Providers',
      description: 'Configure upstream model providers and connection details.',
    },
    {
      href: '/dashboard/combos',
      title: 'Routing combos',
      description: 'Define fallback routing across configured providers.',
    },
    {
      href: '/dashboard/usage',
      title: 'Usage',
      description: 'Inspect routed requests, token usage, and cost.',
    },
    {
      href: '/dashboard/health',
      title: 'Health',
      description: 'Monitor the local control plane through its live event stream.',
    },
  ];

  const connection = $derived(dashboardConnectionStatus(data.bffHealthy));
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold">Home</h1>
    <p class="mt-1 text-gray-600">Control plane for providers, routing, and runtime observability.</p>
  </div>

  <Card>
    <div class="flex items-start gap-3">
      <span
        class="mt-1 inline-block h-3 w-3 shrink-0 rounded-full {connection.tone === 'success'
          ? 'bg-green-500'
          : 'bg-amber-500'}"
        aria-hidden="true"
      ></span>
      <div>
        <h2 class="font-semibold">{connection.label}</h2>
        <p class="mt-1 text-sm text-gray-600">{connection.detail}</p>
        <p class="mt-2 text-xs text-gray-500">Last checked {new Date(data.ts).toLocaleString()}.</p>
      </div>
    </div>
  </Card>

  <section aria-labelledby="quick-links-heading">
    <h2 id="quick-links-heading" class="text-lg font-semibold">Quick access</h2>
    <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each quickLinks as link}
        <a
          href={link.href}
          class="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-[var(--color-primary)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          <h3 class="font-semibold text-[var(--color-primary)]">{link.title}</h3>
          <p class="mt-1 text-sm text-gray-600">{link.description}</p>
        </a>
      {/each}
    </div>
  </section>
</div>
