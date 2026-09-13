<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let name = $state('');
  let type = $state('openai');
  let loading = $state(false);
  let submitted = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) { error = 'Name required'; return; }
    loading = true; error = null; submitted = false;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/providers'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      if (r.ok) submitted = true; else error = `Create failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  }
</script>

<Card title="New Provider">
  {#if submitted}
    <p class="text-green-600">Provider created.</p>
  {:else}
    <form onsubmit={handleSubmit} class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input type="text" bind:value={name} class="w-full border border-gray-300 rounded px-3 py-2" placeholder="Provider name" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select bind:value={type} class="w-full border border-gray-300 rounded px-3 py-2">
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
          <option value="gemini">gemini</option>
          <option value="mistral">mistral</option>
          <option value="cohere">cohere</option>
          <option value="openrouter">openrouter</option>
          <option value="custom">custom</option>
        </select>
      </div>
      {#if error}<p class="text-red-600 text-sm">{error}</p>{/if}
      <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Provider'}</Button>
    </form>
  {/if}
</Card>
