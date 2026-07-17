import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const appRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appRoot, "..", "..");
const sourcePath = path.join(appRoot, "content", "public-boundary.json");
const outputRoot = path.join(appRoot, "dist");
const checkOnly = process.argv.includes("--check");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const sourceCommit = process.env.SOURCE_COMMIT;

if (source.schemaVersion !== 1) throw new Error("Unsupported content schema");
if (!/^[0-9a-f]{40}$/.test(sourceCommit || "")) throw new Error("SOURCE_COMMIT must be the exact checked-out commit SHA");
if (!source.site?.title || !source.site?.description) throw new Error("Site metadata is required");
if (source.site.publication?.deployable !== false || !source.site.publication.reason) {
  throw new Error("External deployment must remain disabled with an explicit blocker");
}
if (!Array.isArray(source.sections) || source.sections.length === 0) throw new Error("At least one section is required");

const slugs = new Set();
for (const section of source.sections) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.slug)) throw new Error(`Invalid slug: ${section.slug}`);
  if (slugs.has(section.slug)) throw new Error(`Duplicate slug: ${section.slug}`);
  slugs.add(section.slug);
  if (!section.title || !section.description || typeof section.publishable !== "boolean") {
    throw new Error(`Incomplete section: ${section.slug}`);
  }
  if (section.publishable && !section.source) throw new Error(`Publishable section has no source: ${section.slug}`);
}

const publishableSections = source.sections.filter((section) => section.publishable);
if (publishableSections.length !== 1 || publishableSections[0].slug !== "quickstart") {
  throw new Error("Quickstart must be the sole publishable section");
}
const reviewedInputs = await Promise.all(publishableSections.map(async (section) => {
  const bytes = await readFile(path.join(repositoryRoot, section.source));
  return { slug: section.slug, source: section.source, sha256: createHash("sha256").update(bytes).digest("hex") };
}));

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const cards = source.sections.map((section) => `
  <article id="${escapeHtml(section.slug)}" aria-labelledby="${escapeHtml(section.slug)}-title">
    <p class="status">${section.publishable ? "Reviewed" : "Content pending review"}</p>
    <h2 id="${escapeHtml(section.slug)}-title">${escapeHtml(section.title)}</h2>
    <p>${escapeHtml(section.description)}</p>${section.publishable ? `\n    <p><a href="./${escapeHtml(section.slug)}.md">Read the reviewed source</a></p>` : ""}
  </article>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(source.site.description)}">
  <title>${escapeHtml(source.site.title)}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header>
    <p class="eyebrow">Documentation scaffold</p>
    <h1>${escapeHtml(source.site.title)}</h1>
    <p>${escapeHtml(source.site.description)}</p>
    <p class="notice">This preview defines the public information boundary. Sections remain unpublished until their content is reviewed and source-backed.</p>
  </header>
  <main id="content">${cards}
  </main>
  <footer><p>Build input: content/public-boundary.json</p></footer>
</body>
</html>
`;

const css = `:root{color-scheme:light dark;font:16px/1.55 system-ui,sans-serif}*{box-sizing:border-box}body{max-width:72rem;margin:auto;padding:2rem;color:CanvasText;background:Canvas}.skip{position:absolute;left:-9999px}.skip:focus{left:1rem;top:1rem;padding:.5rem;background:Canvas}.eyebrow,.status{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}.notice,article{border:1px solid GrayText;border-radius:.5rem;padding:1rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem;margin-block:2rem}h1,h2{line-height:1.2}footer{border-top:1px solid GrayText;margin-top:2rem;padding-top:1rem}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}\n`;

const searchIndex = source.sections.map(({ slug, title, description, publishable }) => ({
  slug, title, description, publishable,
}));
const buildManifest = {
  schemaVersion: 1,
  sourceCommit,
  source: "content/public-boundary.json",
  sourceSha256: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
  outputs: ["index.html", "styles.css", "search-index.json"],
  deployable: source.site.publication.deployable,
  deploymentBlocker: source.site.publication.reason,
  publishableSections: publishableSections.map(({ slug }) => slug),
  reviewedInputs,
};

if (checkOnly) {
  console.log(`Validated ${source.sections.length} public documentation section(s); deployable=${buildManifest.deployable}.`);
  process.exit(0);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "index.html"), html);
await writeFile(path.join(outputRoot, "styles.css"), css);
await writeFile(path.join(outputRoot, "search-index.json"), JSON.stringify(searchIndex, null, 2) + "\n");
await writeFile(path.join(outputRoot, "build-manifest.json"), JSON.stringify(buildManifest, null, 2) + "\n");
for (const input of reviewedInputs) {
  await copyFile(path.join(repositoryRoot, input.source), path.join(outputRoot, `${input.slug}.md`));
}
console.log(`Built deterministic docs scaffold with ${source.sections.length} section(s); deployable=${buildManifest.deployable}.`);
