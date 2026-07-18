<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';

  type Condition =
    | { type: 'header'; header: string; op: 'equals' | 'contains' | 'starts_with'; value: string }
    | { type: 'query'; param: string; op: 'equals' | 'contains' | 'starts_with'; value: string }
    | { type: 'body'; path: string; op: 'equals' | 'contains' | 'starts_with'; value: string }
    | { type: 'always' };

  type Action =
    | { type: 'model'; model: string }
    | { type: 'fallback_chain'; models: string[] }
    | { type: 'reject'; statusCode: number; body?: string }
    | { type: 'rewrite'; from: string; to: string };

  type Rule = { id: string; condition: Condition; action: Action; note?: string };

  let rules = $state<Rule[]>([
    { id: crypto.randomUUID(), condition: { type: 'header', header: 'X-Tier', op: 'equals', value: 'pro' }, action: { type: 'model', model: 'claude-sonnet-4' } },
    { id: crypto.randomUUID(), condition: { type: 'always' }, action: { type: 'fallback_chain', models: ['claude-sonnet-4', 'gpt-4o'] } },
  ]);
  let json = $derived(JSON.stringify(rules, null, 2));

  function addRule() {
    rules = [...rules, { id: crypto.randomUUID(), condition: { type: 'always' }, action: { type: 'model', model: '' } }];
  }
  function removeRule(id: string) {
    rules = rules.filter((r) => r.id !== id);
  }
  function moveUp(idx: number) {
    if (idx === 0) return;
    [rules[idx - 1], rules[idx]] = [rules[idx], rules[idx - 1]];
    rules = [...rules];
  }
  function moveDown(idx: number) {
    if (idx >= rules.length - 1) return;
    [rules[idx], rules[idx + 1]] = [rules[idx + 1], rules[idx]];
    rules = [...rules];
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <p class="text-sm text-gray-600">Rules are evaluated in order. First match wins.</p>
    <Button onclick={addRule}>+ Add rule</Button>
  </div>

  {#if rules.length === 0}
    <p class="text-gray-500 text-sm">No rules. All traffic falls through to the chain.</p>
  {:else}
    <ol class="space-y-2">
      {#each rules as r, i (r.id)}
        <li class="border border-gray-200 rounded p-3 bg-white">
          <div class="flex items-start gap-3">
            <span class="text-gray-400 font-mono text-sm w-6 text-right pt-0.5">{i + 1}</span>
            <div class="flex-1 grid grid-cols-2 gap-2">
              <div>
                <label for={`rule-${r.id}-condition`} class="text-xs text-gray-500">If</label>
                <select id={`rule-${r.id}-condition`} bind:value={r.condition.type} class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                  <option value="header">header</option>
                  <option value="query">query param</option>
                  <option value="body">body path</option>
                  <option value="always">always</option>
                </select>
                {#if r.condition.type !== 'always'}
                  <div class="flex gap-1 mt-1">
                    <input
                      value={(r.condition as any).header ?? (r.condition as any).param ?? (r.condition as any).path ?? ''}
                      oninput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        if (r.condition.type === 'header') (r.condition as any).header = v;
                        else if (r.condition.type === 'query') (r.condition as any).param = v;
                        else if (r.condition.type === 'body') (r.condition as any).path = v;
                      }}
                      placeholder="key/path"
                      class="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                    />
                    <select bind:value={r.condition.op} class="px-1 py-1 border border-gray-300 rounded text-xs">
                      <option value="equals">=</option>
                      <option value="contains">~</option>
                      <option value="starts_with">^</option>
                    </select>
                    <input bind:value={r.condition.value} placeholder="value" class="flex-1 px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                {/if}
              </div>
              <div>
                <label for={`rule-${r.id}-action`} class="text-xs text-gray-500">Then</label>
                <select id={`rule-${r.id}-action`} bind:value={r.action.type} class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                  <option value="model">route to model</option>
                  <option value="fallback_chain">fallback chain</option>
                  <option value="reject">reject</option>
                  <option value="rewrite">rewrite model</option>
                </select>
                {#if r.action.type === 'model'}
                  <input bind:value={r.action.model} placeholder="model id" class="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono" />
                {:else if r.action.type === 'reject'}
                  <input type="number" bind:value={r.action.statusCode} class="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs" />
                {/if}
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <button class="text-gray-500 hover:bg-gray-100 px-2 rounded text-sm" onclick={() => moveUp(i)}>↑</button>
              <button class="text-gray-500 hover:bg-gray-100 px-2 rounded text-sm" onclick={() => moveDown(i)}>↓</button>
              <button class="text-red-500 hover:bg-red-50 px-2 rounded text-sm" onclick={() => removeRule(r.id)}>×</button>
            </div>
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  <details class="mt-3">
    <summary class="cursor-pointer text-sm font-medium text-gray-700">JSON preview</summary>
    <pre class="mt-2 bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">{json}</pre>
  </details>
</div>
