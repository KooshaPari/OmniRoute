<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let devMode = $state(false);
  let verboseLogging = $state(false);
  let apiDocs = $state(true);
  let playground = $state(true);
  let hotReload = $state(false);
  let sourceMaps = $state(false);
  let experimental = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/settings/developer'))
      .then((r) => r.json())
      .then((d) => {
        devMode = d.devMode;
        verboseLogging = d.verboseLogging;
        apiDocs = d.apiDocs;
        playground = d.playground;
        hotReload = d.hotReload;
        sourceMaps = d.sourceMaps;
        experimental = d.experimental;
      })
      .catch((e) => (error = (e as Error).message))
      .finally(() => (loading = false));
  });

  async function save() {
    saving = true;
    error = null;
    saved = false;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/settings/developer'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          devMode, verboseLogging, apiDocs, playground, hotReload, sourceMaps, experimental,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? 'failed to save');
      saved = true;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Developer Settings</title>
</svelte:head>

<h1>Developer Settings</h1>

<Card>
  <div class="field">
    <label>
      <input type="checkbox" bind:checked={devMode} />
      Developer mode
    </label>
    <p class="desc">Enable developer tooling and diagnostics.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={verboseLogging} />
      Verbose logging
    </label>
    <p class="desc">Log every request and response at debug level.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={apiDocs} />
      API docs
    </label>
    <p class="desc">Expose interactive API documentation endpoints.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={playground} />
      Playground
    </label>
    <p class="desc">Enable the interactive request playground.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={hotReload} />
      Hot reload
    </label>
    <p class="desc">Reload configuration without restarting the server.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={sourceMaps} />
      Source maps
    </label>
    <p class="desc">Emit source maps for debugging bundled code.</p>
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={experimental} />
      Experimental features
    </label>
    <p class="desc">Enable unreleased, experimental capabilities.</p>
  </div>

  <div class="actions">
    <Button onclick={save} disabled={saving}>
      {saving ? 'Saving...' : 'Save changes'}
    </Button>
    {#if saved}<span class="ok">Saved</span>{/if}
    {#if error}<span class="err">{error}</span>{/if}
  </div>
</Card>

<style>
  :global(.field) { margin-bottom: 1rem; }
  :global(.desc) { margin: .25rem 0 0 1.5rem; font-size: .85rem; color: var(--text-muted); }
  :global(.actions) { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; }
  :global(.ok) { color: var(--success); }
  :global(.err) { color: var(--danger); }
</style>
