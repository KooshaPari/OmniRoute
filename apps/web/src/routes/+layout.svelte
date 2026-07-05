<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  let { children, data } = $props();

  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/providers', label: 'Providers' },
    { href: '/dashboard/usage', label: 'Usage' },
    { href: '/dashboard/health', label: 'Health' },
    { href: '/dashboard/settings/general', label: 'Settings' },
  ];
</script>

<main class="min-h-screen bg-[var(--color-surface)]">
  <header class="border-b border-gray-200 bg-white">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
      <a href="/dashboard" class="text-xl font-bold" style="color: var(--color-primary)">OmniRoute v4</a>
      <nav class="flex gap-1">
        {#each nav as item}
          <a
            href={item.href}
            class="px-3 py-1.5 text-sm rounded hover:bg-gray-100 {$page.url.pathname === item.href ? 'bg-gray-100 font-semibold' : 'text-gray-700'}"
          >
            {item.label}
          </a>
        {/each}
      </nav>
      <div class="ml-auto text-sm text-gray-500">Svelte 5 + SvelteKit 2 + Hono 4 + Tauri 2</div>
    </div>
  </header>
  <div class="max-w-7xl mx-auto px-4 py-6">
    {@render children?.()}
  </div>
</main>
