/** Local PostCSS config so Vite does not pick up the monorepo root config. */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
