<script lang="ts">
  import { onMount } from 'svelte';

  let apiStatus = $state('checking');
  let bffStatus = $state('checking');
  let dbStatus = $state('checking');

  onMount(async () => {
    const checks = [
      { name: 'api', url: '/api/bff/healthz' },
      { name: 'bff', url: '/api/bff/healthz' },
      { name: 'db', url: '/api/bff/healthz' },
    ];

    await Promise.allSettled(
      checks.map(async (check) => {
        try {
          const r = await fetch(check.url, { signal: AbortSignal.timeout(5000) });
          const status = check.name === 'api' ? apiStatus : check.name === 'bff' ? bffStatus : dbStatus;
          const setter = check.name === 'api' ? (v: string) => (apiStatus = v) : check.name === 'bff' ? (v: string) => (bffStatus = v) : (v: string) => (dbStatus = v);
          setter(r.ok ? 'operational' : 'degraded');
        } catch {
          const setter = check.name === 'api' ? (v: string) => (apiStatus = v) : check.name === 'bff' ? (v: string) => (bffStatus = v) : (v: string) => (dbStatus = v);
          setter('down');
        }
      })
    );
  });

  function statusColor(s: string) {
    if (s === 'operational') return 'bg-green-500';
    if (s === 'degraded') return 'bg-yellow-500';
    if (s === 'down') return 'bg-red-500';
    return 'bg-gray-400';
  }

  function statusLabel(s: string) {
    if (s === 'operational') return 'Operational';
    if (s === 'degraded') return 'Degraded';
    if (s === 'down') return 'Down';
    return 'Checking...';
  }
</script>

<svelte:head>
  <title>System Status - OmniRoute</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-2">System Status</h1>
  <p class="text-gray-600 text-sm mb-8">Current operational status of OmniRoute services.</p>

  <div class="space-y-3">
    <div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <span class="font-medium">API Gateway</span>
      <span class="flex items-center gap-2 text-sm">
        <span class="w-2.5 h-2.5 rounded-full {statusColor(apiStatus)}"></span>
        {statusLabel(apiStatus)}
      </span>
    </div>
    <div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <span class="font-medium">BFF Service</span>
      <span class="flex items-center gap-2 text-sm">
        <span class="w-2.5 h-2.5 rounded-full {statusColor(bffStatus)}"></span>
        {statusLabel(bffStatus)}
      </span>
    </div>
    <div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <span class="font-medium">Database</span>
      <span class="flex items-center gap-2 text-sm">
        <span class="w-2.5 h-2.5 rounded-full {statusColor(dbStatus)}"></span>
        {statusLabel(dbStatus)}
      </span>
    </div>
  </div>

  <p class="text-xs text-gray-500 mt-6 text-center">
    Status checks run every 5 minutes. For incidents, visit
    <a href="https://status.omniroute.dev" class="text-indigo-600 hover:underline">status.omniroute.dev</a>.
  </p>
</div>
