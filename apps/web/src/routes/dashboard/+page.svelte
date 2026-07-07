<script lang="ts">
  import { useQuery } from '@tanstack/svelte-query';
  import { browserKbridge } from '$lib/client/kbridge';
  import { formatMicroCents, formatTokens, formatLatency } from '$lib/client/format';
  import type { HealthReport, UsageAggregate } from '@omniroute/shared-types';

  const kbridge = browserKbridge();

  const health = useQuery<HealthReport>({
    queryKey: ['health'],
    queryFn: () => kbridge<HealthReport>({ op: 'health' }),
    refetchInterval: 5000,
  });

  const usage = useQuery<UsageAggregate>({
    queryKey: ['usage', 'aggregate'],
    queryFn: async () => {
      const r = await fetch('/api/usage/aggregate');
      if (!r.ok) throw new Error(`usage ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as UsageAggregate;
    },
  });
</script>

<svelte:head><title>Dashboard · argismonitor</title></svelte:head>

<section class="space-y-6 p-6">
  <header class="flex items-baseline justify-between">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <span class="text-sm text-base-content/60">
      {health.data?.status ?? 'unknown'}
    </span>
  </header>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Requests (24h)</h2>
        <p class="text-3xl font-bold">{usage.data?.totalRequests ?? '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Tokens (24h)</h2>
        <p class="text-3xl font-bold">{usage.data ? formatTokens(usage.data.totalPromptTokens + usage.data.totalCompletionTokens) : '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Cost (24h)</h2>
        <p class="text-3xl font-bold">{usage.data ? formatMicroCents(usage.data.totalCost) : '—'}</p>
      </div>
    </article>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Average latency</h2>
        <p class="text-2xl">{usage.data ? formatLatency(usage.data.averageLatencyMs) : '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Error rate</h2>
        <p class="text-2xl">{usage.data ? `${(usage.data.errorRate * 100).toFixed(2)}%` : '—'}</p>
      </div>
    </article>
  </div>
</section>
