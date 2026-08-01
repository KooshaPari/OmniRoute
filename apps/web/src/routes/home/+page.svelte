<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { dashboardConnectionStatus } from '$lib/dashboard/home-status';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const quickStart = [
    {
      href: '/dashboard/providers',
      title: 'Connect providers',
      description: 'Configure upstream model providers and connection details.',
    },
    {
      href: '/dashboard/combos',
      title: 'Create a routing combo',
      description: 'Define the fallback path across your configured providers.',
    },
    {
      href: '/dashboard/playground',
      title: 'Test a request',
      description: 'Use the playground to confirm a model route end to end.',
    },
    {
      href: '/dashboard/logs',
      title: 'Inspect routed traffic',
      description: 'Review request logs after your first routed request.',
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

  <section aria-labelledby="quick-start-heading">
    <div>
      <h2 id="quick-start-heading" class="text-lg font-semibold">Quick start</h2>
      <p class="mt-1 text-sm text-gray-600">Set up a working route, verify it, then inspect the result.</p>
    </div>
    <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each quickStart as step, index}
        <a
          href={step.href}
          class="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-[var(--color-primary)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          <div class="flex items-start gap-3">
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white"
              aria-hidden="true"
            >{index + 1}</span>
            <div>
              <h3 class="font-semibold text-[var(--color-primary)] group-hover:underline">{step.title}</h3>
              <p class="mt-1 text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </section>
</div>
