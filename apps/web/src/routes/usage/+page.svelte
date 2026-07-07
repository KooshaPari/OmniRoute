<script lang="ts">
  import { useQuery } from '@tanstack/svelte-query';
  import type { UsageAggregate, UsageRecord } from '@omniroute/shared-types';
  import { formatMicroCents, formatTokens, formatLatency, relativeTime } from '$lib/client/format';

  const aggregate = useQuery<UsageAggregate>({
    queryKey: ['usage', 'aggregate'],
    queryFn: async () => {
      const r = await fetch('/api/usage/aggregate');
      if (!r.ok) throw new Error(`usage ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as UsageAggregate;
    },
  });

  const records = useQuery<UsageRecord[]>({
    queryKey: ['usage', 'records'],
    queryFn: async () => {
      const r = await fetch('/api/usage?limit=100');
      if (!r.ok) throw new Error(`usage ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as UsageRecord[];
    },
  });
</script>

<svelte:head><title>Usage · argismonitor</title></svelte:head>

<section class="space-y-6 p-6">
  <h1 class="text-2xl font-bold">Usage</h1>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Requests</h2>
        <p class="text-2xl">{aggregate.data?.totalRequests ?? '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Prompt tokens</h2>
        <p class="text-2xl">{aggregate.data ? formatTokens(aggregate.data.totalPromptTokens) : '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Completion tokens</h2>
        <p class="text-2xl">{aggregate.data ? formatTokens(aggregate.data.totalCompletionTokens) : '—'}</p>
      </div>
    </article>
    <article class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title text-sm">Cost</h2>
        <p class="text-2xl">{aggregate.data ? formatMicroCents(aggregate.data.totalCost) : '—'}</p>
      </div>
    </article>
  </div>

  <div class="overflow-x-auto">
    <table class="table table-zebra">
      <thead>
        <tr><th>Provider</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Latency</th><th>When</th></tr>
      </thead>
      <tbody>
        {#each records.data ?? [] as r (r.id)}
          <tr>
            <td><code>{r.providerId.slice(0, 8)}</code></td>
            <td>{r.model}</td>
            <td>{formatTokens(r.tokens.prompt + r.tokens.completion)}</td>
            <td>{formatMicroCents(r.cost)}</td>
            <td>{formatLatency(r.latencyMs)}</td>
            <td>{relativeTime(new Date(r.ts).toISOString())}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
