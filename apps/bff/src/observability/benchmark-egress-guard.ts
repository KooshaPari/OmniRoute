import dns from "node:dns";
import net from "node:net";

type Fn = (...args: any[]) => any;
type AllowedTargets = {
  health: string;
  dashboardHealth: string;
};

export const REQUIRED_BENCHMARK_GUARDS = [
  "global.fetch", "Bun.connect", "node:net.connect", "node:net.createConnection",
  "node:dns.lookup", "node:dns.resolve",
] as const;
export type GuardName = typeof REQUIRED_BENCHMARK_GUARDS[number];

const loopback = (host: string) => host === "127.0.0.1" || host === "::1" || host === "localhost";
const socketHost = (args: any[]) => {
  const first = args[0];
  if (typeof first === "object" && first) return String(first.hostname ?? first.host ?? "localhost");
  return typeof args[1] === "string" ? args[1] : "localhost";
};

export function installBenchmarkEgressGuard() {
  const bun = (globalThis as any).Bun;
  if (!bun) throw new Error("required benchmark guard API missing: Bun.connect");
  let allowedTargets: AllowedTargets | undefined;
  let allowedLoopbackAttempts = 0;
  let blockedAttemptCount = 0;
  const installed: GuardName[] = [];
  const activations: { api: GuardName; blocked: true }[] = [];
  const originals: { owner: any; key: string; value: Fn }[] = [];

  const reject = (name: GuardName, reason: string): never => {
    blockedAttemptCount++;
    throw new Error(`benchmark blocked ${name} ${reason}`);
  };

  const checkedLoopbackArgs = (
    name: GuardName,
    args: any[],
    hostAt: (values: any[]) => string,
  ): any[] => {
    const host = hostAt(args);
    if (!loopback(host)) return reject(name, `to ${host}`);
    return args;
  };

  const recordPatch = (name: GuardName, owner: any, key: string, original: Fn, wrapped: Fn) => {
    try { owner[key] = wrapped; } catch { throw new Error(`required benchmark guard API unpatchable: ${name}`); }
    if (owner[key] !== wrapped) throw new Error(`required benchmark guard API unpatchable: ${name}`);
    originals.push({ owner, key, value: original });
    installed.push(name);
  };

  const patchFetch = () => {
    const original = globalThis.fetch;
    if (typeof original !== "function") throw new Error("required benchmark guard API missing: global.fetch");
    const wrapped = (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : input;
      if (typeof raw !== "string" || raw.length > 2048 || !raw.startsWith("http://") || /[?#@]/.test(raw)) {
        return reject("global.fetch", "invalid URL input");
      }
      if (!allowedTargets || (init?.method && init.method !== "GET")) {
        return reject("global.fetch", "invalid loopback target");
      }
      if (raw === allowedTargets.health) {
        allowedLoopbackAttempts++;
        // The host and path are constants; the validated integer port is set by the local benchmark harness.
        return original(allowedTargets.health, init); // NOSONAR
      }
      if (raw === allowedTargets.dashboardHealth) {
        allowedLoopbackAttempts++;
        // The host and path are constants; the validated integer port is set by the local benchmark harness.
        return original(allowedTargets.dashboardHealth, init); // NOSONAR
      }
      return reject("global.fetch", "invalid loopback target");
    };
    recordPatch("global.fetch", globalThis, "fetch", original, wrapped);
  };

  const patch = (name: GuardName, owner: any, key: string, hostAt: (args: any[]) => string) => {
    const original = owner?.[key] as Fn | undefined;
    if (typeof original !== "function") throw new Error(`required benchmark guard API missing: ${name}`);
    const wrapped = (...args: any[]) => {
      const invocationArgs = checkedLoopbackArgs(name, args, hostAt);
      return Reflect.apply(original, owner, invocationArgs);
    };
    recordPatch(name, owner, key, original, wrapped);
  };

  try {
    patchFetch();
    patch("Bun.connect", bun, "connect", (a) => String(a[0]?.hostname ?? a[0]?.host ?? ""));
    patch("node:net.connect", net, "connect", socketHost);
    patch("node:net.createConnection", net, "createConnection", socketHost);
    patch("node:dns.lookup", dns, "lookup", (a) => String(a[0]));
    patch("node:dns.resolve", dns, "resolve", (a) => String(a[0]));
  } catch (error) {
    for (let index = originals.length - 1; index >= 0; index--) {
      const item = originals[index];
      item.owner[item.key] = item.value;
    }
    throw error;
  }
  if (JSON.stringify(installed) !== JSON.stringify(REQUIRED_BENCHMARK_GUARDS)) throw new Error("incomplete benchmark guard set");

  const probes: Record<GuardName, () => unknown> = {
    "global.fetch": () => globalThis.fetch("https://guard.invalid"),
    "Bun.connect": () => bun.connect({ hostname: "guard.invalid", port: 443 }),
    "node:net.connect": () => net.connect({ host: "guard.invalid", port: 443 }),
    "node:net.createConnection": () => net.createConnection({ host: "guard.invalid", port: 443 }),
    "node:dns.lookup": () => dns.lookup("guard.invalid", () => {}),
    "node:dns.resolve": () => dns.resolve("guard.invalid", () => {}),
  };
  for (const api of installed) {
    const before = blockedAttemptCount;
    try { probes[api](); } catch { /* expected synchronous rejection */ }
    if (blockedAttemptCount !== before + 1) throw new Error(`benchmark guard activation failed: ${api}`);
    activations.push({ api, blocked: true });
  }
  blockedAttemptCount = 0;

  return {
    setAllowedLoopbackPort(port: number) {
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("benchmark allowed loopback port must be an integer from 1 to 65535");
      }
      allowedTargets = Object.freeze({
        health: `http://127.0.0.1:${port}/healthz`,
        dashboardHealth: `http://127.0.0.1:${port}/api/dashboard/health`,
      });
    },
    installedCoverage: () => [...installed],
    activationResults: () => activations.map((value) => ({ ...value })),
    allowedLoopbackAttempts: () => allowedLoopbackAttempts,
    blockedAttemptCount: () => blockedAttemptCount,
    restore() {
      for (let index = originals.length - 1; index >= 0; index--) {
        const item = originals[index];
        item.owner[item.key] = item.value;
      }
    },
  };
}
