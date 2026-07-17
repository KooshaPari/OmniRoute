import dns from "node:dns";
import net from "node:net";

type GuardedFunction = (...args: any[]) => any;

export const BENCHMARK_GUARD_COVERAGE = [
  "global.fetch",
  "Bun.connect",
  "node:net.connect",
  "node:net.createConnection",
  "node:dns.lookup",
  "node:dns.resolve",
] as const;

function hostFromSocketArgs(args: any[]): string {
  const first = args[0];
  if (typeof first === "object" && first) return String(first.hostname ?? first.host ?? "localhost");
  return typeof args[1] === "string" ? args[1] : "localhost";
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function installBenchmarkEgressGuard() {
  let blockedAttemptCount = 0;
  const originals = new Map<[object, string], GuardedFunction>();
  const guard = (owner: object, key: string, hostAt: (args: any[]) => string) => {
    const original = (owner as any)[key] as GuardedFunction | undefined;
    if (typeof original !== "function") return;
    originals.set([owner, key], original);
    (owner as any)[key] = (...args: any[]) => {
      const host = hostAt(args);
      if (!isLoopback(host)) {
        blockedAttemptCount++;
        throw new Error(`benchmark blocked ${key} to non-loopback host ${host}`);
      }
      return original.apply(owner, args);
    };
  };

  const bunRuntime = (globalThis as any).Bun as object | undefined;
  if (bunRuntime) guard(bunRuntime, "connect", (args) => String(args[0]?.hostname ?? args[0]?.host ?? ""));
  guard(net, "connect", hostFromSocketArgs);
  guard(net, "createConnection", hostFromSocketArgs);
  guard(dns, "lookup", (args) => String(args[0]));
  guard(dns, "resolve", (args) => String(args[0]));

  return {
    blockedAttemptCount: () => blockedAttemptCount,
    restore() {
      for (const [[owner, key], original] of originals) (owner as any)[key] = original;
    },
  };
}
