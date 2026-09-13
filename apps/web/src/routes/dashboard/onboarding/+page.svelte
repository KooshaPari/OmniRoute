<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let steps = $state<{ id: string; name: string; done: boolean }[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/onboarding'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { steps = d.steps ?? []; error = null; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function toggle(s: typeof steps[0]) {
    saving = true;
    try {
      s.done = !s.done;
      const r = await fetch(bffApiUrl('/api/dashboard/onboarding'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      if (!r.ok) { s.done = !s.done; error = `Update failed: ${r.status}`; }
      else error = null;
    } catch (e) { error = (e as Error).message; s.done = !s.done; }
    finally { saving = false; }
  }
</script>

<Card title="Onboarding">
  {#if loading}
    <p class="text-gray-500">Loading onboarding...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <ul class="space-y-2">
      {#each steps as s (s.id)}
        <li class="flex items-center justify-between border-b py-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={s.done} onchange={() => toggle(s)} />
            <span class={s.done ? 'line-through text-gray-400' : ''}>{s.name}</span>
          </label>
          <span class="text-xs text-gray-500">{s.id}</span>
        </li>
      {/each}
      {#if steps.length === 0}
        <li class="text-gray-500">No onboarding steps.</li>
      {/if}
    </ul>
  {/if}
</Card>
