<script lang="ts">
  import { useQuery } from '@tanstack/svelte-query';
  import type { Combo } from '@omniroute/shared-types';

  const combos = useQuery<Combo[]>({
    queryKey: ['combos'],
    queryFn: async () => {
      const r = await fetch('/api/combos');
      if (!r.ok) throw new Error(`combos ${r.status}`);
      const body = await r.json();
      if (!body.ok) throw new Error(body.error.message);
      return body.data as Combo[];
    },
  });
</script>

<svelte:head><title>Combos · argismonitor</title></svelte:head>

<section class="space-y-4 p-6">
  <header class="flex items-baseline justify-between">
    <h1 class="text-2xl font-bold">Combos</h1>
    <a href="/combos/new" class="btn btn-sm btn-primary">+ New combo</a>
  </header>

  {#if combos.isPending}
    <p class="text-base-content/60">Loading…</p>
  {:else if combos.isError}
    <p class="text-error">{String(combos.error)}</p>
  {:else if combos.data && combos.data.length === 0}
    <div class="card bg-base-200">
      <div class="card-body items-center text-center">
        <p class="text-base-content/60">No combos yet. Combos chain providers with fallback rules.</p>
        <a href="/combos/new" class="btn btn-primary">Create combo</a>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each combos.data ?? [] as c (c.id)}
        <a href="/combos/{c.name}" class="card bg-base-200 transition hover:bg-base-300">
          <div class="card-body">
            <h2 class="card-title">{c.displayName}</h2>
            <p class="text-xs text-base-content/60">{c.name} · {c.steps.length} step{c.steps.length === 1 ? '' : 's'}</p>
            {#if c.description}
              <p class="text-sm">{c.description}</p>
            {/if}
            <div class="mt-2 flex flex-wrap gap-1">
              {#each c.tags as t (t)}<span class="badge badge-sm">{t}</span>{/each}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
