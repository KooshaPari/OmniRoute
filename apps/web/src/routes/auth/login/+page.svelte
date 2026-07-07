<script lang="ts">
  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function submit() {
    loading = true;
    error = '';
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'password', email, password }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        error = body?.error?.message ?? `HTTP ${r.status}`;
        return;
      }
      window.location.href = '/dashboard';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Sign in · argismonitor</title></svelte:head>

<section class="mx-auto mt-24 max-w-sm space-y-4">
  <h1 class="text-2xl font-bold">Sign in</h1>
  <form class="space-y-3" onsubmit={(e) => { e.preventDefault(); submit(); }}>
    <label class="form-control">
      <span class="label-text">Email</span>
      <input class="input input-bordered" type="email" bind:value={email} required />
    </label>
    <label class="form-control">
      <span class="label-text">Password</span>
      <input class="input input-bordered" type="password" bind:value={password} required />
    </label>
    {#if error}
      <p class="text-sm text-error">{error}</p>
    {/if}
    <button class="btn btn-primary w-full" disabled={loading}>
      {loading ? '…' : 'Sign in'}
    </button>
  </form>
</section>
