/**
 * Canonical fork identity SSOT reader.
 * Single source of truth: `.fork-identity.json` (project root).
 *
 * Reads are cached at module load — file changes require a restart.
 * This is intentional: identity is a build-time concern, not a runtime state.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ForkCapabilities {
  modernization: Record<string, string>;
  security: Record<string, string>;
  sidecars: Record<string, string>;
  rust: Record<string, string>;
}

export interface ForkProvenance {
  buildSha: string;
  buildAt: string;
  gitRemote: string;
}

export interface ForkIdentity {
  name: string;
  version: string;
  releaseChannel: string;
  fork: {
    name: string;
    upstream: string;
    forkPoint: string;
    channel: string;
    supportLevel: string;
  };
  capabilities: ForkCapabilities;
  provenance: ForkProvenance;
}

let _cached: ForkIdentity | null = null;

/** Read fork identity from `.fork-identity.json` (cached). */
export function getForkIdentity(): ForkIdentity {
  if (_cached) return _cached;
  const path = resolve(process.cwd(), ".fork-identity.json");
  const raw = readFileSync(path, "utf8");
  _cached = JSON.parse(raw) as ForkIdentity;
  return _cached;
}

/** Test-only: reset the module-level cache. */
export function __resetForkIdentityCache(): void {
  _cached = null;
}

/** Convenience: name@version string. */
export function forkIdentityString(): string {
  const id = getForkIdentity();
  return `${id.name}@${id.version}`;
}
