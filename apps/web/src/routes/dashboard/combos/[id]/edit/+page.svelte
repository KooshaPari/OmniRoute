<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import FlowEditor from '$lib/components/combos/FlowEditor.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type Model = { id: string; name: string; provider: string };
  type Fallback = { model: string; condition: 'on-error' | 'on-rate-limit' | 'on-cost'; priority: number };
  type ComboNode = { id: string; type?: string; data: { label: string; model: string; condition?: string }; position: { x: number; y: number } };
  type ComboEdge = { id: string; source: string; target: string; label?: string; style?: string };

  let id = $state('');
  let name = $state('');
  let primary = $state('');
  let strategy = $state<'first-success'|'round-robin'|'cost-optimized'|'latency-optimized'>('first-success');
  let fallbacks = $state<Fallback[]>([]);
  let costBudget = $state(500);
  let available = $state<Model[]>([]);
  let saving = $state(false);
  let saved = $state(false);
  let dirty = $state(false);
  let view = $state<'form' | 'flow'>('form');

  onMount(async () => {
    id = $page.params.id;
    const r = await fetch('http://localhost:4322/api/dashboard/combos');
    if (r.ok) {
      const j = await r.json();
      const found = (j.combos ?? []).find((c: { id: string }) => c.id === id);
      if (found) {
        name = found.name; primary = found.primary; strategy = found.strategy;
        fallbacks = (found.fallbacks ?? []).map((m: string, i: number) => ({ model: m, condition: 'on-error' as const, priority: i + 1 }));
      }
    }
    const m = await fetch('http://localhost:4322/api/dashboard/playground/models');
    if (m.ok) available = (await m.json()).models ?? [];
  });

  function addFallback(model: string) {
    if (!model || fallbacks.some((f) => f.model === model)) return;
    fallbacks = [...fallbacks, { model, condition: 'on-error', priority: fallbacks.length + 1 }];
    dirty = true;
  }
  function removeFallback(model: string) {
    fallbacks = fallbacks.filter((f) => f.model !== model);
    dirty = true;
  }
  function moveUp(idx: number) {
    if (idx === 0) return;
    [fallbacks[idx - 1], fallbacks[idx]] = [fallbacks[idx], fallbacks[idx - 1]];
    fallbacks = fallbacks.map((f, i) => ({ ...f, priority: i + 1 }));
    dirty = true;
  }
  function moveDown(idx: number) {
    if (idx >= fallbacks.length - 1) return;
    [fallbacks[idx], fallbacks[idx + 1]] = [fallbacks[idx + 1], fallbacks[idx]];
    fallbacks = fallbacks.map((f, i) => ({ ...f, priority: i + 1 }));
    dirty = true;
  }

  async function save() {
    saving = true;
    try {
      await fetch('http://localhost:4322/api/dashboard/combos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, name, primary, fallbacks: fallbacks.map((f) => f.model), strategy }),
      });
      saved = true; dirty = false;
    } finally { saving = false; }
  }
</script>

<div class="space-y-4 max-w-4xl">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Edit combo <span class="text-gray-500 font-mono text-base">{id}</span></h1>
    <div class="flex items-center gap-2">
      <div class="border border-gray-200 rounded-lg p-1 flex">
        <button class="px-3 py-1 text-sm rounded {view === 'form' ? 'bg-gray-100 font-semibold' : 'text-gray-600'}" onclick={() => view = 'form'}>Form</button>
        <button class="px-3 py-1 text-sm rounded {view === 'flow' ? 'bg-gray-100 font-semibold' : 'text-gray-600'}" onclick={() => view = 'flow'}>Flow</button>
      </div>
      <Button variant="secondary" onclick={() => history.back()}>Cancel</Button>
      <Button onclick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : (saved ? 'Saved' : 'Save')}</Button>
    </div>
  </div>

  {#if view === 'form'}
    <Card title="Identity">
      <div class="space-y-3 max-w-md">
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Combo name</span>
          <input bind:value={name} oninput={() => dirty = true} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Strategy</span>
          <select bind:value={strategy} onchange={() => dirty = true} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded">
            <option value="first-success">first-success</option>
            <option value="round-robin">round-robin</option>
            <option value="cost-optimized">cost-optimized</option>
            <option value="latency-optimized">latency-optimized</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Monthly cost budget (USD)</span>
          <input type="number" min="0" step="10" bind:value={costBudget} oninput={() => dirty = true} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
        </label>
      </div>
    </Card>

    <Card title="Primary model">
      <select bind:value={primary} onchange={() => dirty = true} class="w-full px-3 py-2 border border-gray-300 rounded font-mono">
        <option value="">select primary...</option>
        {#each available as m}<option value={m.id}>{m.name} ({m.provider})</option>{/each}
      </select>
    </Card>

    <Card title="Fallback chain">
      {#if fallbacks.length === 0}
        <p class="text-gray-500 text-sm">No fallbacks.</p>
      {:else}
        <ol class="space-y-2">
          {#each fallbacks as f, i (f.model)}
            <li class="flex items-center gap-2 border border-gray-200 rounded p-2">
              <span class="text-gray-400 font-mono text-sm w-6 text-right">{f.priority}</span>
              <span class="font-mono text-sm flex-1">{f.model}</span>
              <button class="text-gray-600 hover:bg-gray-100 px-2 rounded" onclick={() => moveUp(i)}>↑</button>
              <button class="text-gray-600 hover:bg-gray-100 px-2 rounded" onclick={() => moveDown(i)}>↓</button>
              <button class="text-red-600 hover:bg-red-50 px-2 rounded" onclick={() => removeFallback(f.model)}>×</button>
            </li>
          {/each}
        </ol>
      {/if}
      <div class="mt-3 flex items-center gap-2">
        <select id="add-fb" class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm">
          <option value="">add fallback...</option>
          {#each available.filter((m) => m.id !== primary && !fallbacks.some((f) => f.model === m.id)) as m}
            <option value={m.id}>{m.name} ({m.provider})</option>
          {/each}
        </select>
        <Button onclick={() => { const sel = document.getElementById('add-fb') as HTMLSelectElement | null; if (sel && sel.value) { addFallback(sel.value); sel.value = ''; } }}>Add</Button>
      </div>
    </Card>
  {:else}
    <Card title="Visual flow editor">
      <FlowEditor primaryModel={primary} fallbackModels={fallbacks.map((f) => f.model)} />
      <p class="text-xs text-gray-500 mt-3">
        The flow editor reflects the same ComboNode/Edge data structures. Edits in form view re-render in flow view automatically (and vice versa when bidirectional sync lands in v4.0.1).
      </p>
    </Card>
  {/if}
</div>
