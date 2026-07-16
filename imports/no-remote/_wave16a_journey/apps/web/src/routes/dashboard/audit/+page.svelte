<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Audit = { id: string; ts: string; actor: string; action: string; target: string; ip: string; result: 'success' | 'failure' };
  let events = $state<Audit[]>([]);
  onMount(async () => {
    const r = await fetch('http://localhost:4322/api/dashboard/audit');
    if (r.ok) events = (await r.json()).events ?? [];
  });
</script>

<Card title="Audit log">
  <input type="search" placeholder="Filter by actor, action, target..." class="w-full mb-3 px-3 py-2 border border-gray-300 rounded" />
  {#if events.length === 0}
    <p class="text-gray-500">No audit events.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr><th class="text-left px-3 py-2 font-semibold">Time</th><th class="text-left px-3 py-2 font-semibold">Actor</th><th class="text-left px-3 py-2 font-semibold">Action</th><th class="text-left px-3 py-2 font-semibold">Target</th><th class="text-left px-3 py-2 font-semibold">IP</th><th class="text-left px-3 py-2 font-semibold">Result</th></tr>
        </thead>
        <tbody>
          {#each events as e (e.id)}
            <tr class="border-b border-gray-100">
              <td class="px-3 py-2 text-gray-500 font-mono text-xs">{e.ts}</td>
              <td class="px-3 py-2">{e.actor}</td>
              <td class="px-3 py-2 font-mono text-xs">{e.action}</td>
              <td class="px-3 py-2 font-mono text-xs">{e.target}</td>
              <td class="px-3 py-2 text-gray-500 font-mono text-xs">{e.ip}</td>
              <td class="px-3 py-2">
                <span class="px-2 py-0.5 rounded text-xs {e.result === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">{e.result}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
