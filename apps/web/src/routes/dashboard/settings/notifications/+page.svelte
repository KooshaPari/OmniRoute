<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let emailEnabled = $state(true);
  let pushEnabled = $state(false);
  let inAppEnabled = $state(true);
  let outageAlerts = $state(true);
  let comboHealth = $state(true);
  let usageSpike = $state(true);
  let releaseNotes = $state(false);
  let dailyDigest = $state(false);
  let digestTime = $state('09:00');
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/notifications'))
      .then(r => r.json())
      .then(d => {
        emailEnabled = d.channels.email; pushEnabled = d.channels.push;
        inAppEnabled = d.channels.inApp; outageAlerts = d.events.outage;
        comboHealth = d.events.comboHealth; usageSpike = d.events.usageSpike;
        releaseNotes = d.events.release; dailyDigest = d.dailyDigest.enabled;
        digestTime = d.dailyDigest.time;
      })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; saved = false; error = null;
    try {
      const r = await fetch(bffApiUrl('/api/dashboard/notifications'), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channels: { email: emailEnabled, push: pushEnabled, inApp: inAppEnabled },
          events: { outage: outageAlerts, comboHealth, usageSpike, release: releaseNotes },
          dailyDigest: { enabled: dailyDigest, time: digestTime },
        }),
      });
      if (r.ok) saved = true; else error = `Save failed: ${r.status}`;
    } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }
</script>

<Card title="Notification preferences">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else}
    <form onsubmit={save} class="space-y-6 max-w-2xl">
      <div>
        <h3 class="text-sm font-medium text-gray-700 mb-2">Channels</h3>
        <div class="space-y-2 pl-1">
          <div class="flex items-center gap-2">
            <input id="ch-email" type="checkbox" bind:checked={emailEnabled} class="rounded" />
            <label for="ch-email" class="text-sm text-gray-700">Email notifications</label>
          </div>
          <div class="flex items-center gap-2">
            <input id="ch-push" type="checkbox" bind:checked={pushEnabled} class="rounded" />
            <label for="ch-push" class="text-sm text-gray-700">Push notifications</label>
          </div>
          <div class="flex items-center gap-2">
            <input id="ch-inapp" type="checkbox" bind:checked={inAppEnabled} class="rounded" />
            <label for="ch-inapp" class="text-sm text-gray-700">In-app notifications</label>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-700 mb-2">Events</h3>
        <div class="space-y-2 pl-1">
          <div class="flex items-center gap-2">
            <input id="ev-outage" type="checkbox" bind:checked={outageAlerts} class="rounded" />
            <label for="ev-outage" class="text-sm text-gray-700">Service outages</label>
          </div>
          <div class="flex items-center gap-2">
            <input id="ev-combo" type="checkbox" bind:checked={comboHealth} class="rounded" />
            <label for="ev-combo" class="text-sm text-gray-700">Combo health changes</label>
          </div>
          <div class="flex items-center gap-2">
            <input id="ev-spike" type="checkbox" bind:checked={usageSpike} class="rounded" />
            <label for="ev-spike" class="text-sm text-gray-700">Usage spikes</label>
          </div>
          <div class="flex items-center gap-2">
            <input id="ev-release" type="checkbox" bind:checked={releaseNotes} class="rounded" />
            <label for="ev-release" class="text-sm text-gray-700">Release notes</label>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-gray-700 mb-2">Daily digest</h3>
        <div class="space-y-2 pl-1">
          <div class="flex items-center gap-2">
            <input id="digest" type="checkbox" bind:checked={dailyDigest} class="rounded" />
            <label for="digest" class="text-sm text-gray-700">Enable daily digest</label>
          </div>
          {#if dailyDigest}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Digest time</label>
              <input type="time" bind:value={digestTime} class="px-3 py-2 border border-gray-300 rounded" />
            </div>
          {/if}
        </div>
      </div>
      {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </form>
  {/if}
</Card>
