import nodeAdapter from "@sveltejs/adapter-node";
import staticAdapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const adapter = process.env.TAURI_BUILD ? staticAdapter({ fallback: "index.html" }) : nodeAdapter();

const config = {
  preprocess: vitePreprocess(),
  kit: { adapter },
};

export default config;
