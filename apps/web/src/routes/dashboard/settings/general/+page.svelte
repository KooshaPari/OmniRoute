<script lang="ts">
  import { bffApiUrl } from '$lib/bff-origin';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let baseUrl = $state('http://localhost:20128');
  let telemetry = $state(true);
  let autoUpdate = $state(true);
  let language = $state('en');
  let theme = $state('auto');
  let submitting = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    submitting = true;
    error = null;
    saved = false;
    try {
      const res = await fetch(bffApiUrl('/api/dashboard/settings'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ baseUrl, telemetry, autoUpdate, language, theme }),
      });
      if (res.ok) {
        saved = true;
      } else {
        error = `Save failed: ${res.status}`;
      }
    } catch (err) {
      error = `Network error: ${(err as Error).message}`;
    } finally {
      submitting = false;
    }
  }
</script>

<Card title="General settings">
  <form onsubmit={handleSubmit} class="space-y-4 max-w-2xl">
    <div>
      <label for="baseUrl" class="block text-sm font-medium text-gray-700 mb-1">Upstream base URL</label>
      <input id="baseUrl" type="url" bind:value={baseUrl} class="w-full px-3 py-2 border border-gray-300 rounded" />
      <p class="text-xs text-gray-500 mt-1">The Next.js /v1/* endpoint that the BFF reverse-proxies to.</p>
    </div>

    <div>
      <label for="language" class="block text-sm font-medium text-gray-700 mb-1">Language</label>
      <select id="language" bind:value={language} class="w-full px-3 py-2 border border-gray-300 rounded">
        <option value="en">English</option>
        <option value="zh-CN">中文 (简体)</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
        <option value="de">Deutsch</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
        <option value="pt-BR">Português (Brasil)</option>
        <option value="ru">Русский</option>
        <option value="ar">العربية</option>
        <option value="he">עברית</option>
      </select>
    </div>

    <div>
      <label for="theme" class="block text-sm font-medium text-gray-700 mb-1">Theme</label>
      <select id="theme" bind:value={theme} class="w-full px-3 py-2 border border-gray-300 rounded">
        <option value="auto">Auto (system)</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div class="flex items-center gap-2">
      <input id="telemetry" type="checkbox" bind:checked={telemetry} class="rounded" />
      <label for="telemetry" class="text-sm text-gray-700">Send anonymous usage telemetry</label>
    </div>

    <div class="flex items-center gap-2">
      <input id="autoUpdate" type="checkbox" bind:checked={autoUpdate} class="rounded" />
      <label for="autoUpdate" class="text-sm text-gray-700">Auto-update the desktop app (Tauri updater)</label>
    </div>

    {#if saved}<p class="text-sm text-green-600">Saved.</p>{/if}
    {#if error}<p class="text-sm text-red-600">{error}</p>{/if}

    <Button type="submit" disabled={submitting}>
      {submitting ? 'Saving...' : 'Save settings'}
    </Button>
  </form>
</Card>
