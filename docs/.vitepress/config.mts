import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Phenotype Registry",
  description: "Master index for Phenotype specs, patterns, templates, and library research.",
  base: process.env.GITHUB_PAGES === "true" ? "/phenotype-registry/" : "/",
  cleanUrls: true,
  lastUpdated: true,
  // Repo-root SSOT files (BOUNDARY_OWNERS, ECOSYSTEM_MAP, registry/*.json) are linked from docs.
  ignoreDeadLinks: true,
  // Skip template/stub files that contain literal < > placeholders
  // (intentionally ambiguous HTML which Vue parser can't close).
  srcExclude: [
    "**/_template.md",
    "**/_template.md.txt",
    "**/*.template.md",
    "**/_stub/**",
    "**/intent/**",
    "**/boundary/**",
  ],
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
              { text: "Zero-Loop Plan", link: "/rationalization/ZERO_LOOP_ECOSYSTEM_PLAN" },
              { text: "Ecosystem DAG", link: "/rationalization/ECOSYSTEM_DAG" },
              { text: "Session Protocol", link: "/rationalization/SESSION_ARTIFACT_PROTOCOL" },
            ],
          },
          {
            text: "Sessions",
            items: [
              { text: "20260617 disposition wave", link: "/sessions/20260617-ecosystem-disposition-wave/03_DAG_WBS" },
              { text: "20260617 gap-port retro", link: "/sessions/20260617-ecosystem-gap-port-retro/00_SESSION_OVERVIEW" },
            ],
          },
          {
            text: "ADRs",
            items: [
              { text: "ECO index", link: "/adrs/" },
              { text: "ADR-004 Staging", link: "/adr/ADR-004-absorption-staging-vs-canonical" },
              { text: "ADR-005 AgilePlus", link: "/adr/ADR-005-agileplus-governance-boundary" },
              { text: "ADR-006 Zero-Loop", link: "/adr/ADR-006-zero-loop-agent-session" },
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
