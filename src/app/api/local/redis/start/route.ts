import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { isLocalRequestAllowed } from "@/lib/security/localEndpoints";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = process.env.OMNIROUTE_REDIS_CONTAINER_NAME || "omniroute-redis";
const HOST_PORT = process.env.OMNIROUTE_REDIS_HOST_PORT || "6379";
const IMAGE = process.env.OMNIROUTE_REDIS_IMAGE || "docker.io/redis:7-alpine";

const RUNTIME_PREFERENCE = ["podman", "docker"];

async function detectRuntime(): Promise<string | null> {
  for (const candidate of RUNTIME_PREFERENCE) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 3000 });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

export async function POST() {
  const guard = isLocalRequestAllowed();
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  const runtime = await detectRuntime();
  if (!runtime) {
    return NextResponse.json(
      { ok: false, error: "No container runtime (podman or docker) found on PATH" },
      { status: 503 }
    );
  }

  try {
    // -d detached, --rm auto-remove on stop, -p publish, --restart unless-stopped for dev convenience
    const args = [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "--rm",
      "-p",
      `${HOST_PORT}:6379`,
      "--restart",
      "unless-stopped",
      IMAGE,
    ];
    const { stdout, stderr } = await execFileAsync(runtime, args, { timeout: 30_000 });
    return NextResponse.json({ ok: true, runtime, name: CONTAINER_NAME, port: HOST_PORT, stdout: stdout.trim(), stderr: stderr.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, runtime, error: message }, { status: 500 });
  }
}