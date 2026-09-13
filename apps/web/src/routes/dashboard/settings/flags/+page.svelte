<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  type Flag = { key: string; description: string; default: boolean; rollout: number; userOverride: boolean | null };
  let flags = $state<Flag[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/flags'))
      .then(r => r.json())
      .then(d => { flags = d.flags; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function toggleOverride(flag: Flag) {
    saving = true; error = null;
    const newOverride = flag.userOverride === null ? !flag.default : flag.userOverride ? false : true;
    try {
      const r = await fetch(bffApiUrl(`/api/dashboard/flags/${encodeURIComponent(flag.key)}`), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userOverride: newOverride }),
      });
      if (r.ok) { flag.userOverride = newOverride; flags = [...flags]; saved = true; }
      else error = `Update failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Feature flags">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else if error && flags.length === 0}<p class="text-red-600">{error}</p>
  {:else}
    <div class="divide-y divide-gray-200 max-w-2xl">
      {#each flags as flag}
        <div class="flex items-center justify-between py-3">
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">{flag.key}</div>
            <div class="text-xs text-gray-500">{flag.description}</div>
            <div class="text-xs text-gray-400 mt-1">Default: {flag.default ? 'on' : 'off'} &middot; Rollout: {flag.rollout}%</div>
          </div>
          <button onclick={() => toggleOverride(flag)} disabled={saving}
            class="text-sm px-3 py-1 rounded border {flag.userOverride === true ? 'bg-green-100 text-green-700 border-green-300' : flag.userOverride === false ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-500 border-gray-300'}">
            {flag.userOverride === true ? 'Force on' : flag.userOverride === false ? 'Force off' : 'Default'}
          </button>
        </div>
      {/each}
    </div>
    {#if saved}<p class="text-sm text-green-600 mt-3">Override saved.</p>{/if}
    {#if error}<p class="text-sm text-red-600 mt-3">{error}</p>{/if}
  {/if}
</Card>
