<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let smtpHost = $state('');
  let smtpPort = $state(587);
  let smtpUser = $state('');
  let smtpFrom = $state('');
  let smtpTls = $state(true);
  let configured = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/email'))
      .then(r => r.json())
      .then(d => {
        smtpHost = d.smtpHost; smtpPort = d.smtpPort; smtpUser = d.smtpUser;
        smtpFrom = d.smtpFrom; smtpTls = d.smtpTls; configured = d.configured;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/email'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpFrom, smtpTls }),
      });
      if (r.ok) { saved = true; configured = true; } else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Email configuration">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      {#if configured}
        <p class="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">Email is configured.</p>
      {/if}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">SMTP host</label>
        <input type="text" bind:value={smtpHost} placeholder="smtp.example.com" class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">SMTP port</label>
        <input type="number" bind:value={smtpPort} min={1} max={65535} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">SMTP username</label>
        <input type="text" bind:value={smtpUser} class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">From address</label>
        <input type="email" bind:value={smtpFrom} placeholder="noreply@example.com" class="w-full px-3 py-2 border border-gray-300 rounded" />
      </div>
      <div class="flex items-center gap-2">
        <input id="tls" type="checkbox" bind:checked={smtpTls} class="rounded" />
        <label for="tls" class="text-sm text-gray-700">Require TLS</label>
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
