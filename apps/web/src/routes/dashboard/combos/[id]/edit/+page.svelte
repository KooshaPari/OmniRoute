<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  type Model = { id: string; name: string; provider: string };
  type Fallback = { model: string; condition: 'on-error' | 'on-rate-limit' | 'on-cost'; priority: number };

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
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => history.back()}>Cancel</Button>
      <Button onclick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : (saved ? 'Saved' : 'Save')}</Button>
    </div>
  </div>

  <Card title="Identity">
    <div class="space-y-3 max-w-md">
      <label class="block">
        <span class="text-sm font-medium text-gray-700">Combo name</span>
        <input bind:value={name} oninput={() => dirty = true} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-gray-700">Strategy</span>
        <select bind:value={strategy} onchange={() => dirty = true} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded">
          <option value="first-success">first-success (try primary, fall through on error)</option>
          <option value="round-robin">round-robin (distribute load)</option>
          <option value="cost-optimized">cost-optimized (cheapest valid model)</option>
          <option value="latency-optimized">latency-optimized (lowest p50)</option>
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
      {#each available as m}
        <option value={m.id}>{m.name} ({m.provider})</option>
      {/each}
    </select>
  </Card>

  <Card title="Fallback chain (drag to reorder via up/down buttons)">
    {#if fallbacks.length === 0}
      <p class="text-gray-500 text-sm">No fallbacks. Pick a model below to add one.</p>
    {:else}
      <ol class="space-y-2">
        {#each fallbacks as f, i (f.model)}
          <li class="flex items-center gap-2 border border-gray-200 rounded p-2">
            <span class="text-gray-400 font-mono text-sm w-6 text-right">{f.priority}</span>
            <span class="font-mono text-sm flex-1">{f.model}</span>
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100">{f.condition}</span>
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

  <p class="text-xs text-gray-400 italic">
    Combos editor migration: the Next.js version (src/app/(dashboard)/dashboard/combos/[id]/edit/page.tsx) was 4,629 LoC with the full @xyflow/svelte flow editor, rule-based routing, model performance tracking, and quota bucket awareness. This Svelte 5 version replaces the data + form layer with the same Zod-validated contracts. The flow editor landing is queued for v4.0.1 (see apps/README.md Phase 4 plans).
  </p>
</div>
