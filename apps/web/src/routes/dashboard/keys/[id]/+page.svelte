<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { unavailableMessage } from '$lib/observability/unavailable';

  type Key = { id: string; name: string; prefix: string; fullKey: string; createdAt: string; lastUsedAt: string | null; revoked: boolean };
  type Usage = { date: string; requests: number }[];
  type UsageResponse = { status?: 'unavailable'; source?: string; usage: Usage };
  let key = $state<Key | null>(null);
  let usage = $state<Usage>([]);
  let usageResponse = $state<UsageResponse | null>(null);
  let revealed = $state(false);
  let loading = $state(true);
  let keyUnavailable = $state<string | null>(null);
  const maxUsage = $derived(usage.length ? Math.max(1, ...usage.map((u) => u.requests)) : 1);

  onMount(async () => {
    const id = $page.params.id;
    const [a, b] = await Promise.all([
      fetch(`http://localhost:4322/api/dashboard/keys/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`http://localhost:4322/api/dashboard/keys/${id}/usage`).then((r) => r.ok ? r.json() : null),
    ]);
    key = a?.key ?? (a?.status === 'unavailable' ? null : a);
    if (a?.status === 'unavailable') keyUnavailable = unavailableMessage(a, 'API key');
    usageResponse = b;
    usage = b?.usage ?? [];
    loading = false;
  });

  async function revoke() {
    if (!key) return;
    if (!confirm(`Revoke key "${key.name}"?`)) return;
    await fetch(`http://localhost:4322/api/dashboard/keys/${key.id}/revoke`, { method: 'POST' });
    key.revoked = true;
  }
  const usageUnavailable = $derived(unavailableMessage(usageResponse, 'Key usage metrics'));
</script>

{#if loading}
  <p class="text-gray-500">Loading...</p>
{:else if keyUnavailable}
  <p class="text-amber-700">{keyUnavailable}</p>
{:else if key}
  <div class="space-y-4">
    <Card title={key.revoked ? 'API key (revoked)' : 'API key'}>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between"><dt class="text-gray-500">Name</dt><dd class="font-medium">{key.name}</dd></div>
        <div class="flex justify-between"><dt class="text-gray-500">ID</dt><dd class="font-mono text-xs">{key.id}</dd></div>
        <div class="flex justify-between"><dt class="text-gray-500">Prefix</dt><dd class="font-mono text-xs">{key.prefix}</dd></div>
        <div class="flex justify-between"><dt class="text-gray-500">Created</dt><dd class="text-gray-700">{new Date(key.createdAt).toLocaleString()}</dd></div>
        <div class="flex justify-between"><dt class="text-gray-500">Last used</dt><dd class="text-gray-700">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'never'}</dd></div>
        <div class="flex justify-between items-center">
          <dt class="text-gray-500">Full key</dt>
          <dd class="flex items-center gap-2">
            <code class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{revealed ? key.fullKey : `${key.prefix}${'•'.repeat(32)}`}</code>
            <Button size="sm" variant="secondary" onclick={() => revealed = !revealed}>{revealed ? 'Hide' : 'Reveal'}</Button>
          </dd>
        </div>
      </dl>
      {#if !key.revoked}
        <div class="mt-4"><Button variant="danger" onclick={revoke}>Revoke key</Button></div>
      {/if}
    </Card>

    <Card title="Usage (last 30d)">
      {#if usageUnavailable}
        <p class="text-gray-500">{usageUnavailable}</p>
      {:else if usage.length === 0}
        <p class="text-gray-500">No usage recorded.</p>
      {:else}
        <div class="flex items-end gap-px h-24">
          {#each usage as u}
            <div class="flex-1 bg-blue-400 rounded-t" style="height: {(u.requests / maxUsage) * 100}%" title="{u.date}: {u.requests} req"></div>
          {/each}
        </div>
      {/if}
    </Card>
  </div>
{/if}
