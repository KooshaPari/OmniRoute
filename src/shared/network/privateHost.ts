// Host classification shared by the outbound URL guard and the provider registry.
//
// #11122: `open-sse/config/providerRegistry.ts` needs `isPrivateHost`, and that module is
// reachable from `ProviderDetailPageClient.tsx`. `outboundUrlGuard.ts` reached for `node:net`'s
// `isIP`, so importing it from the registry broke the browser bundle with
// `Could not resolve "node:net"` (caught by tests/unit/media-page-client-browser-bundle.test.ts,
// which has been red on the release branch since #11122 merged).
// The classification therefore lives here, on a pure-JS `ipVersion`, with NO platform imports.
//
// Two constraints this module MUST keep — both enforced by tests:
//   1. No `node:*` import: it is bundled for the browser.
//   2. No `@/`-aliased import: `./outboundUrlGuard.ts` re-exports from here and is loaded by the
//      packaged CLI (`omniroute setup-opencode`), where no tsconfig resolves the alias (#7682).

// Vendored from Node's own `lib/internal/net.js` so `ipVersion` stays verdict-for-verdict
// identical to `isIP` — a NARROWER match would silently reclassify a private address as public
// and open the very egress the guard exists to close. `tests/unit/private-host-ip-parity-11122`
// asserts that parity against `node:net` directly.
const V4_SEG = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const V4_STR = `(?:${V4_SEG}\\.){3}${V4_SEG}`;
const V6_SEG = "(?:[0-9a-fA-F]{1,4})";

const IPV4_RE = new RegExp(`^${V4_STR}$`);

const IPV6_RE = new RegExp(
  "^(?:" +
    `(?:${V6_SEG}:){7}(?:${V6_SEG}|:)|` +
    `(?:${V6_SEG}:){6}(?:${V4_STR}|:${V6_SEG}|:)|` +
    `(?:${V6_SEG}:){5}(?::${V4_STR}|(?::${V6_SEG}){1,2}|:)|` +
    `(?:${V6_SEG}:){4}(?:(?::${V6_SEG}){0,1}:${V4_STR}|(?::${V6_SEG}){1,3}|:)|` +
    `(?:${V6_SEG}:){3}(?:(?::${V6_SEG}){0,2}:${V4_STR}|(?::${V6_SEG}){1,4}|:)|` +
    `(?:${V6_SEG}:){2}(?:(?::${V6_SEG}){0,3}:${V4_STR}|(?::${V6_SEG}){1,5}|:)|` +
    `(?:${V6_SEG}:){1}(?:(?::${V6_SEG}){0,4}:${V4_STR}|(?::${V6_SEG}){1,6}|:)|` +
    `(?::(?:(?::${V6_SEG}){0,5}:${V4_STR}|(?::${V6_SEG}){1,7}|:))` +
    ")(?:%[0-9a-zA-Z-.:]{1,64})?$"
);

// Longest legal literal is 45 chars (`ffff:…:255.255.255.255`) plus a `%zone`. Every quantifier
// above is bounded, and this guard keeps the alternation from ever seeing a long hostile string
// (AGENTS.md → "Regex Security (ReDoS)").
const MAX_IP_LITERAL_LENGTH = 110;

/** Pure-JS `node:net#isIP`: 4, 6, or 0 when the string is not an IP literal. */
export function ipVersion(host: string): 0 | 4 | 6 {
  if (!host || host.length > MAX_IP_LITERAL_LENGTH) return 0;
  if (IPV4_RE.test(host)) return 4;
  return IPV6_RE.test(host) ? 6 : 0;
}

export function normalizeHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

export function isPrivateHost(hostname: string) {
  const normalized = normalizeHost(hostname);
  if (!normalized) return true;

  if (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    // `::` is the IPv6 twin of `0.0.0.0`: connecting to it reaches a service bound
    // to the IPv6 loopback, so it has to be refused alongside its IPv4 spelling.
    normalized === "::" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    // `.internal` is reserved for private use (ICANN-style) and is the
    // hostname suffix used by GCP/Azure metadata probes
    // (e.g. `metadata.google.internal`).
    normalized.endsWith(".internal") ||
    normalized.startsWith("::ffff:")
  ) {
    return true;
  }

  if (ipVersion(normalized) === 4) {
    const octets = normalized.split(".").map((segment) => parseInt(segment, 10));
    const [a, b] = octets;

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ipVersion(normalized) === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}
