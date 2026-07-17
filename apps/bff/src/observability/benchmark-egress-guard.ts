import dns from "node:dns";
import net from "node:net";

type Fn = (...args: any[]) => any;
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
  let allowedPort: string | undefined;
  let allowedLoopbackAttempts = 0;
  let blockedAttemptCount = 0;
  const installed: GuardName[] = [];
  const activations: { api: GuardName; blocked: true }[] = [];
  const originals: { owner: any; key: string; value: Fn }[] = [];

  const patch = (name: GuardName, owner: any, key: string, hostAt: (args: any[]) => string, urlMode = false) => {
    const original = owner?.[key] as Fn | undefined;
    if (typeof original !== "function") throw new Error(`required benchmark guard API missing: ${name}`);
    const wrapped = (...args: any[]) => {
      let invocationArgs = args;
      if (urlMode) {
        const raw = args[0] instanceof Request ? args[0].url : args[0];
        if (typeof raw !== "string" || raw.length > 2048 || !raw.startsWith("http://") || /[?#@]/.test(raw)) {
          blockedAttemptCount++;
          throw new Error(`benchmark blocked ${name} invalid URL input`);
        }
        const pathStart = raw.indexOf("/", "http://".length);
        const authority = raw.slice("http://".length, pathStart < 0 ? raw.length : pathStart);
        const requestedPath = pathStart < 0 ? "" : raw.slice(pathStart);
        const safePath = requestedPath === "/healthz" ? "/healthz" :
          requestedPath === "/api/dashboard/health" ? "/api/dashboard/health" : undefined;
        const init = args[1] as RequestInit | undefined;
        if (authority !== `127.0.0.1:${allowedPort}` || !safePath || (init?.method && init.method !== "GET")) {
          blockedAttemptCount++;
          throw new Error(`benchmark blocked ${name} invalid loopback target`);
        }
        invocationArgs = [`http://127.0.0.1:${allowedPort}${safePath}`, init];
        allowedLoopbackAttempts++;
      } else {
        const host = hostAt(args);
        if (!loopback(host)) {
          blockedAttemptCount++;
          throw new Error(`benchmark blocked ${name} to ${host}`);
        }
      }
      return original.apply(owner, invocationArgs);
    };
    try { owner[key] = wrapped; } catch { throw new Error(`required benchmark guard API unpatchable: ${name}`); }
    if (owner[key] !== wrapped) throw new Error(`required benchmark guard API unpatchable: ${name}`);
    originals.push({ owner, key, value: original });
    installed.push(name);
  };

  try {
    patch("global.fetch", globalThis, "fetch", () => "", true);
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
    setAllowedLoopbackPort(port: number) { allowedPort = String(port); },
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
