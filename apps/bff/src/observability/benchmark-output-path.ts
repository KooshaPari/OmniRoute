import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_EVIDENCE_ROOT = fileURLToPath(new URL("../../../../latency-evidence/", import.meta.url));

export async function prepareBenchmarkOutputPath(
  input: string,
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
): Promise<string> {
  if (!input || input.length > 120 || path.isAbsolute(input) || path.basename(input) !== input ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(input)) {
    throw new Error("benchmark output must be a bounded JSON filename within latency-evidence");
  }
  await mkdir(evidenceRoot, { recursive: true, mode: 0o700 });
  const trustedRoot = await realpath(evidenceRoot);
  const output = path.join(trustedRoot, input);
  const relative = path.relative(trustedRoot, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("benchmark output escapes latency-evidence");
  }
  try {
    const existing = await lstat(output);
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error("benchmark output is not a regular file");
    const canonical = await realpath(output);
    if (path.dirname(canonical) !== trustedRoot) throw new Error("benchmark output symlink escapes latency-evidence");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return output;
}
