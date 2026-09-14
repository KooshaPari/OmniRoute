import { isIPv4, isIPv6 } from "node:net";
import { randomUUID } from "node:crypto";

/**
 * Trusted peer-IP stamping for the custom Node HTTP servers.
 *
 * The Next.js middleware runtime (proxy.ts → runAuthzPipeline) exposes NO socket
 * or peer IP — only request headers, ALL of which are client-controlled. The
 * LOCAL_ONLY route guard (spawn-capable routes) must decide locality from the
 * real TCP peer, never from the spoofable Host header.
 *
 * Our custom servers DO have the real `req.socket.remoteAddress`. They stamp it
 * into PEER_IP_HEADER as `<token>|<ip>`, where <token> is a per-process secret
 * (OMNIROUTE_PEER_STAMP_TOKEN). Any client-supplied value of PEER_IP_HEADER is
 * deleted first, so a remote caller cannot pre-populate it. The middleware
 * (src/server/authz/policies/management.ts → resolveStampedPeer) trusts the IP
 * ONLY when the token matches this process's secret; otherwise it fails closed.
 *
 * Keep PEER_IP_HEADER in sync with PEER_IP_HEADER in
 * src/server/authz/headers.ts (the TS side cannot import this .mjs).
 */
export const PEER_IP_HEADER = "x-omniroute-peer-ip";

/**
 * Companion header to PEER_IP_HEADER: `<token>|1` when the inbound TCP request
 * carried forwarding headers (`x-forwarded-for` / `x-real-ip`) or arrived from
 * a Cloudflare edge IP with `cf-connecting-ip`, `<token>|0` otherwise. Required
 * so the middleware can tell that a loopback socket is the reverse-proxy hop
 * (nginx / Caddy / Cloudflare Tunnel) and NOT trust it as local — without this,
 * a leaked JWT over a public tunnel would reach the LOCAL_ONLY routes that
 * spawn child processes (Hard Rules #15 + #17; port of upstream decolua/9router
 * commit da667836).
 *
 * Keep VIA_PROXY_HEADER in sync with VIA_PROXY_HEADER in
 * src/server/authz/headers.ts (the TS side cannot import this .mjs).
 */
export const VIA_PROXY_HEADER = "x-omniroute-via-proxy";

/**
 * Cloudflare IPv4 ranges used to authenticate the `cf-connecting-ip` header.
 *
 * `cf-connecting-ip` is Cloudflare-specific: a direct client can trivially forge
 * it, but only traffic actually routed through Cloudflare originates from one of
 * these IP addresses. We therefore trust `cf-connecting-ip` as a proxy marker
 * ONLY when `req.socket.remoteAddress` falls inside these ranges.
 *
 * Source: https://api.cloudflare.com/client/v4/ips
 * Snapshot date: 2026-08-25
 * Refresh: re-query the URL above periodically (quarterly is a safe default,
 * or whenever Cloudflare announces edge-range changes) and replace the arrays.
 *
 * This list is intentionally embedded as a static constant. peer-stamp.mjs is
 * packaged into the standalone server artifact and MUST NOT depend on runtime
 * file/network access to load the ranges.
 */
const CLOUDFLARE_IPV4_CIDRS = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

/**
 * Cloudflare IPv6 ranges (same semantics as CLOUDFLARE_IPV4_CIDRS).
 *
 * Source: https://api.cloudflare.com/client/v4/ips
 * Snapshot date: 2026-08-25
 * Refresh: re-query the URL above periodically (quarterly is a safe default,
 * or whenever Cloudflare announces edge-range changes) and replace the arrays.
 */
const CLOUDFLARE_IPV6_CIDRS = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

/** Generate (once) and return the per-process stamp token, persisting it in env
 *  so the middleware running in the same process reads the identical value. */
export function ensurePeerStampToken() {
  process.env.OMNIROUTE_PEER_STAMP_TOKEN ||= randomUUID();
  return process.env.OMNIROUTE_PEER_STAMP_TOKEN;
}

/** Convert an IPv4 address string to an unsigned 32-bit integer. */
function ipv4ToInt(ip) {
  const parts = ip.split(".");
  return (
    ((parseInt(parts[0], 10) << 24) |
      (parseInt(parts[1], 10) << 16) |
      (parseInt(parts[2], 10) << 8) |
      parseInt(parts[3], 10)) >>>
    0
  );
}

/** Check whether `ip` belongs to the given IPv4 CIDR. */
export function matchesIPv4Cidr(ip, cidr) {
  const [range, bits] = cidr.split("/");
  const maskBits = parseInt(bits, 10);
  if (maskBits === 0) return true;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  return ipInt >>> (32 - maskBits) === rangeInt >>> (32 - maskBits);
}

/** Convert an IPv6 address string to a 128-bit BigInt. */
function ipv6ToBigInt(ip) {
  // Expand the compressed form into 8 groups of 16-bit hex.
  let expanded = ip;
  if (expanded.includes("::")) {
    const [left, right] = expanded.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    const fill = Array.from({ length: missing }, () => "0");
    expanded = [...leftGroups, ...fill, ...rightGroups].join(":");
  }
  const groups = expanded.split(":");
  let result = 0n;
  for (const group of groups) {
    result = (result << 16n) | BigInt(parseInt(group || "0", 16));
  }
  return result;
}

/** Check whether `ip` belongs to the given IPv6 CIDR. */
export function matchesIPv6Cidr(ip, cidr) {
  const [range, bits] = cidr.split("/");
  const maskBits = parseInt(bits, 10);
  if (maskBits === 0) return true;
  const ipInt = ipv6ToBigInt(ip);
  const rangeInt = ipv6ToBigInt(range);
  const mask = -1n << (128n - BigInt(maskBits));
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Return true when `ip` is a Cloudflare edge address. IPv4-mapped IPv6 addresses
 * (`::ffff:x.x.x.x`) are normalized to dotted-decimal before checking.
 */
export function isCloudflareIP(ip) {
  if (!ip) return false;
  let normalized = ip.replace(/^::ffff:/i, "");
  if (normalized === ip) {
    // Full-form IPv4-mapped addresses (0:0:0:0:0:ffff:a.b.c.d) also need to be
    // normalized to dotted-decimal before the CIDR check.
    const fullFormMatch = /^(?:0+:){5}ffff:([0-9.]+)$/i.exec(ip);
    if (fullFormMatch) normalized = fullFormMatch[1];
  }
  if (isIPv4(normalized)) {
    return CLOUDFLARE_IPV4_CIDRS.some((cidr) => matchesIPv4Cidr(normalized, cidr));
  }
  if (isIPv6(normalized)) {
    return CLOUDFLARE_IPV6_CIDRS.some((cidr) => matchesIPv6Cidr(normalized, cidr));
  }
  return false;
}

/** Strip any client-supplied PEER_IP_HEADER + VIA_PROXY_HEADER and stamp the
 *  real TCP peer IP plus a token-protected via-proxy marker. Never throws — a
 *  stamping failure must not block a request (it degrades to "locality
 *  unknown" → fail closed in the middleware). */
export function stampPeerIp(req) {
  try {
    if (!req || !req.headers) return;
    // Node lowercases incoming header names; delete kills any client value.
    delete req.headers[PEER_IP_HEADER];
    delete req.headers[VIA_PROXY_HEADER];
    const ip = req.socket && req.socket.remoteAddress;
    if (ip) {
      const token = ensurePeerStampToken();
      req.headers[PEER_IP_HEADER] = `${token}|${ip}`;
      // Forwarding headers present = request arrived via a reverse proxy; the
      // loopback socket is the proxy hop, not the end-user, so it must not be
      // trusted as local. Token-prefix the marker so a remote caller cannot
      // forge it (or its absence) on a non-proxied request.
      //
      // `cf-connecting-ip` is Cloudflare-specific and trivially forged by a
      // direct client. Only treat it as a proxy marker when the TCP peer itself
      // is a Cloudflare edge IP; otherwise a direct forger could flip the
      // via-proxy bit and force the middleware to ignore the real peer IP.
      const hasGenericProxyHeaders = !!(req.headers["x-forwarded-for"] || req.headers["x-real-ip"]);
      const hasCloudflareHeader = !!(req.headers["cf-connecting-ip"] && isCloudflareIP(ip));
      const viaProxy = hasGenericProxyHeaders || hasCloudflareHeader;
      req.headers[VIA_PROXY_HEADER] = `${token}|${viaProxy ? "1" : "0"}`;
    }
  } catch {
    /* never block a request on peer stamping */
  }
}

/** Wrap a Node request listener so every request is peer-stamped first. */
export function wrapRequestListenerWithPeerStamp(listener) {
  return function peerStampingRequestHandler(req, res) {
    stampPeerIp(req);
    return listener.call(this, req, res);
  };
}
