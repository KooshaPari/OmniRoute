<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';

  let data = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch(bffApiUrl('/api/dashboard/security'))
      .then(r => r.json())
      .then(d => { data = d; })
      .catch(e => error = (e as Error).message)
      .finally(() => loading = false);
  });
</script>

<Card title="Security settings">
  {#if loading}<p class="text-gray-500">Loading...</p>
  {:else if error}<p class="text-red-600">{error}</p>
  {:else if data}
    <div class="space-y-3 max-w-2xl">
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">CSRF protection</span>
        <span class="text-sm font-medium {data.csrfEnabled ? 'text-green-600' : 'text-red-600'}">{data.csrfEnabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">Session secret strength</span>
        <span class="text-sm font-medium {data.sessionSecretStrong ? 'text-green-600' : 'text-red-600'}">{data.sessionSecretStrong ? 'Strong' : 'Weak'}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">MITM certificate installed</span>
        <span class="text-sm font-medium">{data.mitmCertInstalled ? 'Yes' : 'No'}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700">OpenAI API key leakage</span>
        <span class="text-sm font-medium {data.openaiApiKeyLeakage === 'safe' ? 'text-green-600' : 'text-red-600'}">{data.openaiApiKeyLeakage}</span>
      </div>
      <div class="flex justify-between items-center py-2">
        <span class="text-sm text-gray-700">JWT secret last rotated</span>
        <span class="text-sm text-gray-500">{new Date(data.jwtSecretRotatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  {/if}
</Card>
