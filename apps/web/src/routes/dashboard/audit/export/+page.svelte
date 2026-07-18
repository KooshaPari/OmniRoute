<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let from = $state('');
  let to = $state('');
  let actor = $state('');
  let action = $state('');
  let format = $state<'json' | 'csv'>('json');
  let exporting = $state(false);
  let exportError = $state<string | null>(null);
  let lastExport = $state<{ url: string; rows: number; ts: string } | null>(null);

  async function doExport() {
    exporting = true;
    exportError = null;
    lastExport = null;
    try {
      const r = await fetch('http://localhost:4322/api/dashboard/audit/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, actor, action, format }),
      });
      if (r.ok) {
        const j = await r.json();
        lastExport = { url: j.url, rows: j.rows, ts: new Date().toISOString() };
      } else {
        const body = await r.json().catch(() => null);
        exportError = body?.source ?? `export failed (${r.status})`;
      }
    } catch (error) {
      exportError = (error as Error).message;
    } finally { exporting = false; }
  }
</script>

<Card title="Audit log export">
  <form onsubmit={(e) => { e.preventDefault(); doExport(); }} class="space-y-4 max-w-md">
    <div>
      <label for="audit-export-from" class="text-sm font-medium text-gray-700">From (ISO date)</label>
      <input id="audit-export-from" type="date" bind:value={from} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
    </div>
    <div>
      <label for="audit-export-to" class="text-sm font-medium text-gray-700">To (ISO date)</label>
      <input id="audit-export-to" type="date" bind:value={to} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
    </div>
    <div>
      <label for="audit-export-actor" class="text-sm font-medium text-gray-700">Actor (user/email or empty for all)</label>
      <input id="audit-export-actor" bind:value={actor} placeholder="e.g. koosha@phenotype" class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
    </div>
    <div>
      <label for="audit-export-action" class="text-sm font-medium text-gray-700">Action prefix (e.g. provider.create or empty)</label>
      <input id="audit-export-action" bind:value={action} placeholder="" class="w-full mt-1 px-3 py-2 border border-gray-300 rounded" />
    </div>
    <div>
      <label for="audit-export-format" class="text-sm font-medium text-gray-700">Format</label>
      <select id="audit-export-format" bind:value={format} class="w-full mt-1 px-3 py-2 border border-gray-300 rounded">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
      </select>
    </div>
    <Button type="submit" disabled={exporting}>{exporting ? 'Exporting...' : 'Export'}</Button>
  </form>

  {#if exportError}
    <p class="mt-4 text-sm text-red-600" role="alert">
      Audit export unavailable: {exportError}
    </p>
  {/if}

  {#if lastExport}
    <div class="mt-4 border border-green-200 bg-green-50 rounded p-3 text-sm">
      <div class="font-medium text-green-800">Export ready</div>
      <div class="text-green-700">{lastExport.rows} rows · generated {lastExport.ts}</div>
      <a href={lastExport.url} class="text-blue-600 hover:underline">Download</a>
    </div>
  {/if}
</Card>
