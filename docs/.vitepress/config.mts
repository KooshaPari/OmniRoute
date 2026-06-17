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
          {
            text: "Rationalization",
            items: [
              { text: "Boundary shaping", link: "/rationalization/boundary-shaping" },
              { text: "Stack policy", link: "/rationalization/STACK_POLICY" },
              { text: "Domain roles", link: "/rationalization/DOMAIN_ROLES" },
              { text: "Zero-shot orchestration", link: "/rationalization/ZERO_SHOT_ORCHESTRATION" },
            ],
          },
          {
            text: "Sessions",
            items: [
              { text: "20260617 disposition wave", link: "/sessions/20260617-ecosystem-disposition-wave/03_DAG_WBS" },
            ],
          },
          {
            text: "ADRs",
            items: [
              { text: "ECO index", link: "/adrs/" },
            ],
          },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/KooshaPari/phenotype-registry" }],
    search: {
      provider: "local",
    },
  },
});
