<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let theme = $state('auto');
  let accent = $state('#3b82f6');
  let fontSize = $state('medium');
  let sidebarCollapsed = $state(false);
  let compactMode = $state(false);
  let animations = $state(true);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/appearance'))
      .then(r => r.json())
      .then(d => {
        theme = d.theme; accent = d.accentColor; fontSize = d.fontSize;
        sidebarCollapsed = d.sidebarCollapsed; compactMode = d.compactMode;
        animations = d.showAnimations;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/appearance'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme, accentColor: accent, fontSize,
          sidebarCollapsed, compactMode, showAnimations: animations }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Appearance">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-4 max-w-2xl">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Theme</label>
        <select bind:value={theme} class="w-full px-3 py-2 border border-gray-300 rounded">
          <option value="auto">Auto (system)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Accent color</label>
        <input type="color" bind:value={accent} class="w-16 h-10 border border-gray-300 rounded cursor-pointer" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Font size</label>
        <select bind:value={fontSize} class="w-full px-3 py-2 border border-gray-300 rounded">
          <option value="small">Small</option><option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <input id="sidebar" type="checkbox" bind:checked={sidebarCollapsed} class="rounded" />
        <label for="sidebar" class="text-sm text-gray-700">Collapse sidebar by default</label>
      </div>
      <div class="flex items-center gap-2">
        <input id="compact" type="checkbox" bind:checked={compactMode} class="rounded" />
        <label for="compact" class="text-sm text-gray-700">Compact mode</label>
      </div>
      <div class="flex items-center gap-2">
        <input id="animations" type="checkbox" bind:checked={animations} class="rounded" />
        <label for="animations" class="text-sm text-gray-700">Show animations</label>
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
