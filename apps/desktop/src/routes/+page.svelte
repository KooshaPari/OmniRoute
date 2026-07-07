<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // The desktop shell embeds apps/web; redirect to dashboard.
    if (typeof window !== 'undefined' && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
      // Inside Tauri webview — serve a placeholder for now.
      return;
    }
    goto('/dashboard');
  });
</script>

<section class="grid h-full place-items-center">
  <div class="text-center">
    <h1 class="text-3xl font-bold text-primary">argismonitor</h1>
    <p class="mt-2 text-sm text-base-content/60">Loading web dashboard…</p>
  </div>
</section>
