<script lang="ts">
  import { onMount } from 'svelte';
  let count = $state(0);
  let bffHealthy = $state<string>('unknown');

  onMount(async () => {
    try {
      const r = await fetch('/api/bff/healthz');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      bffHealthy = j.status === 'ok' ? 'healthy' : `unhealthy: ${JSON.stringify(j)}`;
    } catch (e) {
      bffHealthy = `unreachable: ${(e as Error).message}`;
    }
  });
</script>

<section class="p-8">
  <h1 class="text-4xl font-bold mb-4">Welcome to argismonitor v4</h1>
  <p class="text-gray-700 mb-6">Svelte 5 + SvelteKit 2 + Hono 4 + Tauri 2. Cohabit behind per-route feature flag.</p>

  <div class="border border-gray-200 rounded-lg p-4 bg-white mb-6">
    <h2 class="text-lg font-semibold mb-2">BFF health</h2>
    <code class="text-sm">{bffHealthy}</code>
  </div>

  <button
    class="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-800 text-white font-semibold"
    onclick={() => count++}
  >
    Count: {count}
  </button>
</section>
