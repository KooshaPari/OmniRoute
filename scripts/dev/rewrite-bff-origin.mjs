/**
 * Bulk-replace hard-coded BFF origins with bffApiUrl() / server bffUrl().
 * Usage: node scripts/dev/rewrite-bff-origin.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("apps/web/src");
const HARDCODED = /https?:\/\/localhost:4322/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(svelte|ts|js)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function ensureImport(src, filePath) {
  const isServer = filePath.endsWith("+page.server.ts") || filePath.includes(`${path.sep}server${path.sep}`);
  if (isServer) {
    if (src.includes("bffUrl") && src.includes("$lib/server/bff")) return src;
    if (src.includes("from '$lib/server/bff'") || src.includes('from "$lib/server/bff"')) return src;
    return `import { bffUrl } from '$lib/server/bff';\n${src}`;
  }
  if (src.includes("bffApiUrl") && src.includes("$lib/bff-origin")) return src;
  if (src.includes("from '$lib/bff-origin'") || src.includes('from "$lib/bff-origin"')) return src;
  // Svelte: put import inside <script> if present
  if (filePath.endsWith(".svelte")) {
    const m = src.match(/<script[^>]*>/);
    if (m) {
      const idx = m.index + m[0].length;
      return `${src.slice(0, idx)}\n  import { bffApiUrl } from '$lib/bff-origin';${src.slice(idx)}`;
    }
  }
  return `import { bffApiUrl } from '$lib/bff-origin';\n${src}`;
}

function rewrite(src, filePath) {
  if (!HARDCODED.test(src)) return null;
  HARDCODED.lastIndex = 0;
  let next = src;

  // Template literals: `http://localhost:4322/path${x}`
  next = next.replace(
    /`http:\/\/localhost:4322(\/[^`]*)`/g,
    (_m, pathname) => `bffApiUrl(\`${pathname}\`)`,
  );
  // Single-quoted
  next = next.replace(
    /'http:\/\/localhost:4322(\/[^']*)'/g,
    (_m, pathname) => `bffApiUrl('${pathname}')`,
  );
  // Double-quoted
  next = next.replace(
    /"http:\/\/localhost:4322(\/[^"]*)"/g,
    (_m, pathname) => `bffApiUrl("${pathname}")`,
  );

  const isServer = filePath.endsWith("+page.server.ts");
  if (isServer) {
    next = next.replace(/bffApiUrl\((['"`])(\/[^'"`]*)\1\)/g, (_m, _q, pathname) => {
      return `bffUrl('${pathname}').toString()`;
    });
  }

  next = ensureImport(next, filePath);
  return next;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  if (file.includes(`${path.sep}bff-origin.ts`) || file.includes(`${path.sep}server${path.sep}bff.ts`)) {
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const next = rewrite(src, file);
  if (next && next !== src) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log("updated", path.relative(process.cwd(), file));
  }
}
console.log(`done: ${changed} files`);
