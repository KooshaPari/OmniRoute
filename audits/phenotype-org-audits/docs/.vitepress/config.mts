import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Phenotype Org Audits",
  description: "Redaction-safe public index for Phenotype organization audit history.",
  base: process.env.GITHUB_PAGES === "true" ? "/phenotype-org-audits/" : "/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Audit Map", link: "/audit-map" },
      { text: "Redaction", link: "/redaction" },
      { text: "GitHub", link: "https://github.com/KooshaPari/phenotype-org-audits" },
    ],
    sidebar: [
      {
        text: "Org Audits",
        items: [
          { text: "Overview", link: "/" },
          { text: "Audit Map", link: "/audit-map" },
          { text: "Redaction Policy", link: "/redaction" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/KooshaPari/phenotype-org-audits" },
    ],
    search: {
      provider: "local",
    },
  },
});
