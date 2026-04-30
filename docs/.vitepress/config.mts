import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Phenotype Registry",
  description: "Master index for Phenotype specs, patterns, templates, and library research.",
  base: process.env.GITHUB_PAGES === "true" ? "/phenotype-registry/" : "/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Registries", link: "/registries" },
      { text: "Library Research", link: "/library-research" },
      { text: "GitHub", link: "https://github.com/KooshaPari/phenotype-registry" },
    ],
    sidebar: [
      {
        text: "Phenotype Registry",
        items: [
          { text: "Overview", link: "/" },
          { text: "Registry Reference", link: "/registries" },
          { text: "Library Research", link: "/library-research" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/KooshaPari/phenotype-registry" }],
    search: {
      provider: "local",
    },
  },
});
