import { mkdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareBenchmarkOutputPath } from "./benchmark-output-path";

describe("benchmark output trust boundary", () => {
  it("accepts a bounded filename under the canonical evidence root", async () => {
    const root = path.join(os.tmpdir(), `omniroute-evidence-${crypto.randomUUID()}`);
    await expect(prepareBenchmarkOutputPath("run-1.json", root)).resolves.toBe(path.join(await import("node:fs/promises").then((fs) => fs.realpath(root)), "run-1.json"));
  });

  it.each(["../escape.json", "..\\escape.json", "/tmp/escape.json", "C:\\escape.json", "latency-evidence-evil/run.json", "run.txt", ""])
    ("rejects untrusted output %s", async (value) => {
      const root = path.join(os.tmpdir(), `omniroute-evidence-${crypto.randomUUID()}`);
      await expect(prepareBenchmarkOutputPath(value, root)).rejects.toThrow(/bounded JSON filename/);
    });

  it("rejects a symlink output without following it", async () => {
    const base = path.join(os.tmpdir(), `omniroute-evidence-${crypto.randomUUID()}`);
    const root = path.join(base, "latency-evidence");
    await mkdir(root, { recursive: true });
    await symlink(path.join(base, "outside.json"), path.join(root, "run.json"), "file");
    await expect(prepareBenchmarkOutputPath("run.json", root)).rejects.toThrow(/regular file/);
  });
});
