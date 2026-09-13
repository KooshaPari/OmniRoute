<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';

  type AnalyticsTab = 'overview' | 'evals' | 'search' | 'utilization' | 'combo-health' | 'cache-health' | 'route-trace';
  let activeTab = $state<AnalyticsTab>('overview');
  let range = $state('30d');
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Overview data
  let summary = $state({
    totalCost: 0, totalRequests: 0, uniqueModels: 0, uniqueAccounts: 0,
    uniqueApiKeys: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0,
    fallbackCount: 0, fallbackRatePct: 0, requestedModelCoveragePct: 0, streak: 0
  });
  let byProvider = $state<any[]>([]);
  let byModel = $state<any[]>([]);
  let dailyTrend = $state<any[]>([]);

  // Other tabs
  let evals = $state<any[]>([]);
  let evalsSummary = $state({ totalEvals: 0, passedEvals: 0, failedEvals: 0, avgScore: 0 });
  let searchStats = $state({ totalQueries: 0, successfulQueries: 0, failedQueries: 0, avgLatencyMs: 0 });
  let utilization = $state<any[]>([]);
  let comboHealth = $state<any[]>([]);
  let cacheHealth = $state<any[]>([]);
  let routeTrace = $state<any[]>([]);

  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'evals', label: 'Evals' },
    { id: 'search', label: 'Search' },
    { id: 'utilization', label: 'Utilization' },
    { id: 'combo-health', label: 'Combo Health' },
    { id: 'cache-health', label: 'Cache Health' },
    { id: 'route-trace', label: 'Route Trace' },
  ];

  async function fetchTab(tab: AnalyticsTab) {
    loading = true;
    error = null;
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/analytics/${tab}`), { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch');
      const data = await r.json();
      switch (tab) {
        case 'overview':
          summary = data.summary; byProvider = data.byProvider; byModel = data.byModel; dailyTrend = data.dailyTrend; break;
        case 'evals':
          evals = data.evals; evalsSummary = data.summary; break;
        case 'search':
          searchStats = data; break;
        case 'utilization':
          utilization = data.byProvider ?? []; break;
        case 'combo-health':
          comboHealth = data.comboHealth ?? []; break;
        case 'cache-health':
          cacheHealth = data.cacheHealth ?? []; break;
        case 'route-trace':
          routeTrace = data.routeTrace ?? []; break;
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { fetchTab(activeTab); });
  $effect(() => { if (activeTab) fetchTab(activeTab); });
</script>

<svelte:head>
  <title>Analytics</title>
</svelte:head>

<h1>Analytics</h1>

<div class="tab-bar" role="tablist">
  {#each TABS as tab}
    <button
      role="tab"
      class={activeTab === tab.id ? 'active' : ''}
      onclick={() => activeTab = tab.id}
    >{tab.label}</button>
  {/each}
</div>

<div class="range-selector">
  <label for="range">Range:</label>
  <select id="range" bind:value={range} onchange={() => fetchTab(activeTab)}>
    <option value="1d">1 day</option>
    <option value="7d">7 days</option>
    <option value="30d">30 days</option>
    <option value="90d">90 days</option>
  </select>
</div>

{#if loading}
  <Card class="loading">Loading…</Card>
{:else if error}
  <Card class="error">{error}</Card>
{:else}
  {#if activeTab === 'overview'}
    <Card>
      <div class="stats-grid">
        <div class="stat"><span class="label">Total Cost</span><span class="value">${summary.totalCost.toFixed(4)}</span></div>
        <div class="stat"><span class="label">Total Requests</span><span class="value">{summary.totalRequests}</span></div>
        <div class="stat"><span class="label">Unique Models</span><span class="value">{summary.uniqueModels}</span></div>
        <div class="stat"><span class="label">Fallback Rate</span><span class="value">{summary.fallbackRatePct}%</span></div>
      </div>
      <div class="chart-placeholder">Provider breakdown chart → {byProvider.length} providers</div>
      <div class="chart-placeholder">Daily trend chart → {dailyTrend.length} points</div>
    </Card>
  {:else if activeTab === 'evals'}
    <Card>
      <div class="stats-grid">
        <div class="stat"><span class="label">Total Evals</span><span class="value">{evalsSummary.totalEvals}</span></div>
        <div class="stat"><span class="label">Passed</span><span class="value">{evalsSummary.passedEvals}</span></div>
        <div class="stat"><span class="label">Failed</span><span class="value">{evalsSummary.failedEvals}</span></div>
        <div class="stat"><span class="label">Avg Score</span><span class="value">{evalsSummary.avgScore.toFixed(2)}</span></div>
      </div>
      {#each evals as e}
        <div class="eval-item">{e.name ?? 'Eval'} — {e.status ?? 'pending'}</div>
      {/each}
    </Card>
  {:else if activeTab === 'search'}
    <Card>
      <div class="stats-grid">
        <div class="stat"><span class="label">Total Queries</span><span class="value">{searchStats.totalQueries}</span></div>
        <div class="stat"><span class="label">Successful</span><span class="value">{searchStats.successfulQueries}</span></div>
        <div class="stat"><span class="label">Failed</span><span class="value">{searchStats.failedQueries}</span></div>
        <div class="stat"><span class="label">Avg Latency</span><span class="value">{searchStats.avgLatencyMs}ms</span></div>
      </div>
    </Card>
  {:else if activeTab === 'utilization'}
    <Card>
      {#each utilization as u}
        <div class="util-item">{u.provider ?? 'provider'} — {u.requests ?? 0} reqs</div>
      {/each}
    </Card>
  {:else if activeTab === 'combo-health'}
    <Card>
      {#each comboHealth as c}
        <div class="combo-item">{c.name ?? 'combo'} — health: {c.health ?? 'unknown'}</div>
      {/each}
    </Card>
  {:else if activeTab === 'cache-health'}
    <Card>
      {#each cacheHealth as c}
        <div class="cache-item">{c.key ?? 'cache'} — hit rate: {c.hitRate ?? 0}%</div>
      {/each}
    </Card>
  {:else if activeTab === 'route-trace'}
    <Card>
      {#each routeTrace as r}
        <div class="route-item">{r.route ?? 'route'} — {r.latencyMs ?? 0}ms</div>
      {/each}
    </Card>
  {/if}
{/if}

<style>
  .tab-bar { display: flex; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .tab-bar button { padding: .5rem 1rem; border: 1px solid var(--border); background: var(--bg); border-radius: .375rem; cursor: pointer; }
  .tab-bar button.active { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
  .range-selector { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  .stat { display: flex; flex-direction: column; gap: .25rem; }
  .label { font-size: .875rem; color: var(--text-muted); }
  .value { font-size: 1.25rem; font-weight: 600; }
  .chart-placeholder { padding: 2rem; text-align: center; color: var(--text-muted); background: var(--bg); border-radius: .375rem; margin-bottom: 1rem; }
  .eval-item, .util-item, .combo-item, .cache-item, .route-item { padding: .5rem; border-bottom: 1px solid var(--border); font-size: .875rem; }
</style>
