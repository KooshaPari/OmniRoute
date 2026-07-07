<script lang="ts">
  import { browserKbridge } from '$lib/client/kbridge';

  const kbridge = browserKbridge();
  let pingResult = $state('');

  async function ping() {
    try {
      const r = await kbridge<{ pong: true; latencyMs: number; ts: number }>({ op: 'ping' });
      pingResult = `pong in ${r.latencyMs}ms`;
    } catch (e) {
      pingResult = String(e);
    }
  }
</script>

<svelte:head><title>Settings · argismonitor</title></svelte:head>

<section class="space-y-4 p-6">
  <h1 class="text-2xl font-bold">Settings</h1>

  <article class="card bg-base-200">
    <div class="card-body">
      <h2 class="card-title">kbridge</h2>
      <p class="text-sm text-base-content/60">Unix-socket RPC to the Rust gateway daemon.</p>
      <div class="card-actions">
        <button class="btn btn-primary" onclick={ping}>Test ping</button>
        {#if pingResult}
          <span class="self-center text-sm">{pingResult}</span>
        {/if}
      </div>
    </div>
  </article>

  <article class="card bg-base-200">
    <div class="card-body">
      <h2 class="card-title">Theme</h2>
      <p class="text-sm text-base-content/60">Toggle via the footer button in the sidebar.</p>
    </div>
  </article>
</section>
