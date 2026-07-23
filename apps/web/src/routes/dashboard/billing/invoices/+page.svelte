<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';
  type Invoice = { id: string; number: string; date: string; amount: number; status: 'paid' | 'pending' | 'failed'; pdfUrl: string | null };
  let invoices = $state<Invoice[]>([]);
  let loading = $state(true);
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/billing/invoices'));
    if (r.ok) { const j = await r.json(); invoices = j.invoices ?? []; }
    loading = false;
  });
  const statusColor = { paid: 'bg-green-100 text-green-800', pending: 'bg-yellow-100 text-yellow-800', failed: 'bg-red-100 text-red-800' } as const;
</script>

<Card title="Invoices">
  {#if loading}
    <p class="text-gray-500">Loading invoices...</p>
  {:else if invoices.length === 0}
    <p class="text-gray-500">No invoices yet.</p>
  {:else}
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr><th class="text-left px-3 py-2 font-semibold">Date</th><th class="text-left px-3 py-2 font-semibold">Number</th><th class="text-right px-3 py-2 font-semibold">Amount</th><th class="text-left px-3 py-2 font-semibold">Status</th><th class="text-right px-3 py-2 font-semibold">PDF</th></tr>
      </thead>
      <tbody>
        {#each invoices as i (i.id)}
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 text-gray-500">{i.date}</td>
            <td class="px-3 py-2 font-mono text-xs">{i.number}</td>
            <td class="px-3 py-2 text-right">${i.amount.toFixed(2)}</td>
            <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs {statusColor[i.status]}">{i.status}</span></td>
            <td class="px-3 py-2 text-right">
              {#if i.pdfUrl}
                <a href={i.pdfUrl} class="text-blue-600 hover:underline text-sm">download</a>
              {:else}—{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
