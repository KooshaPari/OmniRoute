<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/client/query';
  import { applyTheme, THEME_STORAGE_KEY, type Theme } from '$lib/client/theme';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { fly } from 'svelte/transition';

  let { children, data } = $props<{ children: () => unknown; data: { user: typeof page.data.user } }>();

  let theme = $state<Theme>('dark');

  $effect(() => {
    if (!browser) return;
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored) {
      theme = stored;
      applyTheme(theme);
    }
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
  }

  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/providers', label: 'Providers' },
    { href: '/combos', label: 'Combos' },
    { href: '/apikeys', label: 'API Keys' },
    { href: '/usage', label: 'Usage' },
    { href: '/chat', label: 'Chat' },
    { href: '/settings', label: 'Settings' },
  ];
</script>

<QueryClientProvider client={queryClient}>
  <div class="grid h-screen grid-cols-[240px_1fr]">
    <aside class="border-r border-base-300 bg-base-200 p-4">
      <header class="mb-6 flex items-center gap-2">
        <span class="text-xl font-bold text-primary">argismonitor</span>
        <span class="badge badge-sm badge-primary">v4</span>
      </header>
      <nav class="flex flex-col gap-1">
        {#each nav as item (item.href)}
          <a
            href={item.href}
            class="rounded px-3 py-2 text-sm hover:bg-base-300"
            class:bg-base-300={page.url.pathname.startsWith(item.href)}
          >
            {item.label}
          </a>
        {/each}
      </nav>
      <footer class="mt-auto pt-6 text-xs text-base-content/60">
        {#if data.user}
          <div>{data.user.displayName}</div>
          <div class="opacity-60">{data.user.email}</div>
        {:else}
          <a href="/auth/login" class="link">Sign in</a>
        {/if}
        <button class="btn btn-xs mt-2" onclick={toggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </footer>
    </aside>

    <main class="overflow-auto">
      {#if browser}
        <div in:fly={{ y: 12, duration: 180 }}>
          {@render children?.()}
        </div>
      {:else}
        {@render children?.()}
      {/if}
    </main>
  </div>
</QueryClientProvider>
