// Tailwind v4 is processed via @tailwindcss/vite (see apps/web/vite.config.ts),
// not via PostCSS. This config is intentionally a no-op so that Vite does not
// try to load the @tailwindcss/postcss plugin when transforming CSS imports
// such as @xyflow/svelte's style.css.
export default {
  plugins: {},
};
