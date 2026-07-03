import { defineDocs, defineConfig } from "fumadocs-mdx/config";

const includeDocsInBuild = process.env.OMNIROUTE_BUILD_DOCS_MODE !== "skip";

export const docs = defineDocs({
  dir: "docs",
  docs: {
    // Runtime-focused Docker builds can skip static docs enumeration entirely.
    // That keeps the desktop/server runtime image aligned with the proxy/API
    // objective while avoiding the heavy Fumadocs graph during constrained
    // webpack production builds.
    files: includeDocsInBuild
      ? [
          "./architecture/**/*.md",
          "./guides/**/*.md",
          "./reference/**/*.md",
          "./frameworks/**/*.md",
          "./routing/**/*.md",
          "./security/**/*.md",
          "./compression/**/*.md",
          "./ops/**/*.md",
        ]
      : [],
  },
});

export default defineConfig();
