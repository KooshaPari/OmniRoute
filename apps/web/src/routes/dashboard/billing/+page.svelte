<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { onMount } from 'svelte';
  type Plan = { name: string; pricePerMonth: number; seats: number; renewsAt: string };
  let plan = $state<Plan | null>(null);
  onMount(async () => {
    const r = await fetch(bffApiUrl('/api/dashboard/billing'));
    if (r.ok) plan = await r.json();
  });
</script>

{#if plan}
  <Card title="Billing">
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div><div class="text-gray-500">Plan</div><div class="font-semibold text-lg">{plan.name}</div></div>
      <div><div class="text-gray-500">Price</div><div class="font-semibold text-lg">${plan.pricePerMonth}/mo</div></div>
      <div><div class="text-gray-500">Seats</div><div class="font-semibold text-lg">{plan.seats}</div></div>
      <div><div class="text-gray-500">Renews</div><div class="font-semibold text-lg">{plan.renewsAt}</div></div>
    </div>
    <div class="mt-4 flex gap-2">
      <Button>Update payment method</Button>
      <Button variant="secondary">Download invoices</Button>
      <Button variant="ghost">Change plan</Button>
    </div>
  </Card>
{/if}
