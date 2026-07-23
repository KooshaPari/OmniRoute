<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount, onDestroy } from 'svelte';

  type Event = { ts: string; level: 'info' | 'warn' | 'error'; message: string };
  let events = $state<Event[]>([]);
  let connected = $state(false);
  let eventSource: EventSource | null = null;

  function start() {
    try {
      eventSource = new EventSource(bffApiUrl('/api/dashboard/health/stream'));
      eventSource.onopen = () => { connected = true; };
      eventSource.onerror = () => { connected = false; };
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          events = [...events.slice(-99), parsed];
        } catch {
          // ignore non-JSON
        }
      };
    } catch (err) {
      events = [...events, { ts: new Date().toISOString(), level: 'error', message: `SSE failed: ${(err as Error).message}` }];
    }
  }

  function stop() {
    eventSource?.close();
    eventSource = null;
    connected = false;
  }

  onMount(start);
  onDestroy(stop);
</script>

<Card title="Health (live SSE)">
  <div class="flex items-center gap-3 mb-3">
    <span class="inline-block w-3 h-3 rounded-full {connected ? 'bg-green-500' : 'bg-red-500'}"></span>
    <span class="text-sm text-gray-700">{connected ? 'Connected' : 'Disconnected'}</span>
    {#if !connected}
      <button onclick={start} class="text-sm text-blue-600 hover:underline">Reconnect</button>
    {:else}
      <button onclick={stop} class="text-sm text-red-600 hover:underline">Disconnect</button>
    {/if}
  </div>

  <div class="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded h-96 overflow-y-auto">
    {#each events as e (e.ts + e.message)}
      <div class="whitespace-pre-wrap">
        <span class="text-gray-500">[{e.ts}]</span>
        <span class={e.level === 'error' ? 'text-red-400' : e.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}>
          {e.level.toUpperCase()}
        </span>
        {e.message}
      </div>
    {/each}
    {#if events.length === 0}
      <div class="text-gray-500">Waiting for events...</div>
    {/if}
  </div>
</Card>
