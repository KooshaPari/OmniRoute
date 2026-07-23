<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg';

  let {
    variant: variantRaw = 'primary',
    size: sizeRaw = 'md',
    disabled = false,
    type = 'button',
    onclick,
    class: className = '',
    children,
  } = $props<{
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    class?: string;
    children?: Snippet;
  }>();

  // Svelte 5's destructured `$props` typings don't always narrow default
  // values, so re-narrow here for safe Record indexing.
  const variant = $derived<Variant>(variantRaw as Variant);
  const size = $derived<Size>(sizeRaw as Size);

  const base =
    'inline-flex items-center justify-center font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const variants: Record<Variant, string> = {
    primary: 'text-white',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const cls = $derived(`${base} ${sizes[size]} ${variants[variant]} ${className}`.trim());
  const style = $derived(variant === 'primary' ? 'background: var(--grad-brand)' : '');
</script>

<button {type} {disabled} class={cls} {style} {onclick}>
  {#if children}{@render children()}{/if}
</button>