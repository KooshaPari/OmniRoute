<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let combo = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/auto-combo'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { combo = d.combo ?? null; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save() {
    saving = true; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/auto-combo'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(combo),
      });
      if (!r.ok) error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { saving = false; }
  }
</script>

<Card title="Auto Combo">
  {#if loading}
    <p class="text-gray-500">Loading combo...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <pre class="bg-gray-50 p-3 rounded text-xs overflow-x-auto mb-3">{JSON.stringify(combo, null, 2)}</pre>
    <Button onclick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Combo'}</Button>
  {/if}
</Card>
