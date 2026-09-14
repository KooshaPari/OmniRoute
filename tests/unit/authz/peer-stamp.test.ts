// Direct unit tests for scripts/dev/peer-stamp.mjs::stampPeerIp.
//
// These tests assert the exact x-omniroute-peer-ip / x-omniroute-via-proxy
// headers the custom server stamps before forwarding the request to Next.js.
// They are intentionally standalone (mock IncomingMessage) so a bug in the
// cf-connecting-ip path can be reproduced by reverting the corresponding line
// in peer-stamp.mjs without relying on the rest of the authz pipeline.
import test from "node:test";
import assert from "node:assert/strict";

const peerStamp = await import("../../../scripts/dev/peer-stamp.mjs");
const {
  stampPeerIp,
  PEER_IP_HEADER,
  VIA_PROXY_HEADER,
  matchesIPv4Cidr,
  matchesIPv6Cidr,
  isCloudflareIP,
} = peerStamp;

const ORIGINAL_STAMP_TOKEN = process.env.OMNIROUTE_PEER_STAMP_TOKEN;

function makeReq(remoteAddress: string, headers: Record<string, string> = {}) {
  return {
    headers: { ...headers },
    socket: { remoteAddress },
  };
}

function getPeerIp(req: ReturnType<typeof makeReq>) {
  return req.headers[PEER_IP_HEADER] ?? null;
}

function getViaProxy(req: ReturnType<typeof makeReq>) {
  return req.headers[VIA_PROXY_HEADER] ?? null;
}

test.after(() => {
  if (ORIGINAL_STAMP_TOKEN === undefined) delete process.env.OMNIROUTE_PEER_STAMP_TOKEN;
  else process.env.OMNIROUTE_PEER_STAMP_TOKEN = ORIGINAL_STAMP_TOKEN;
});

test.beforeEach(() => {
  delete process.env.OMNIROUTE_PEER_STAMP_TOKEN;
  process.env.OMNIROUTE_PEER_STAMP_TOKEN = "stamp-tok";
});

test("stamps peer IP and via-proxy=0 for direct connection (no forwarding headers)", () => {
  const req = makeReq("203.0.113.99");
  stampPeerIp(req);

  assert.equal(
    getPeerIp(req),
    "stamp-tok|203.0.113.99",
    "peer-ip header must contain token|real-ip"
  );
  assert.equal(getViaProxy(req), "stamp-tok|0", "via-proxy must be 0 on direct connection");
});

test("stamps via-proxy=1 when x-forwarded-for is present", () => {
  const req = makeReq("127.0.0.1", { "x-forwarded-for": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getPeerIp(req), "stamp-tok|127.0.0.1", "peer-ip must be the proxy hop");
  assert.equal(getViaProxy(req), "stamp-tok|1", "via-proxy must be 1 behind generic reverse proxy");
});

test("stamps via-proxy=1 when x-real-ip is present", () => {
  const req = makeReq("127.0.0.1", { "x-real-ip": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getViaProxy(req), "stamp-tok|1", "via-proxy must be 1 when x-real-ip present");
});

test("Cloudflare: via-proxy=1 when cf-connecting-ip is present AND peer is a CF edge IP", () => {
  // 172.71.150.1 falls inside Cloudflare's 172.64.0.0/13 range.
  const req = makeReq("172.71.150.1", { "cf-connecting-ip": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getPeerIp(req), "stamp-tok|172.71.150.1", "peer-ip must be the CF edge");
  assert.equal(getViaProxy(req), "stamp-tok|1", "via-proxy must be 1 behind Cloudflare");
});

test("Cloudflare bypass guard: direct forger sending cf-connecting-ip keeps via-proxy=0", () => {
  // A direct client can forge cf-connecting-ip, but its socket peer is not a
  // Cloudflare IP. The via-proxy marker must stay 0 so the middleware checks
  // the real peer IP instead of the forged header.
  const req = makeReq("203.0.113.7", { "cf-connecting-ip": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getPeerIp(req), "stamp-tok|203.0.113.7", "peer-ip must stay the real direct IP");
  assert.equal(
    getViaProxy(req),
    "stamp-tok|0",
    "via-proxy must stay 0 when peer is not Cloudflare"
  );
});

test("x-forwarded-for still wins via-proxy=1 even when cf-connecting-ip is forged", () => {
  const req = makeReq("203.0.113.7", {
    "x-forwarded-for": "203.0.113.99",
    "cf-connecting-ip": "198.51.100.1",
  });
  stampPeerIp(req);

  assert.equal(getViaProxy(req), "stamp-tok|1", "x-forwarded-for must still set via-proxy=1");
});

test("F-05: non-Cloudflare proxy (x-forwarded-for only, no cf-connecting-ip) marks via-proxy=1", () => {
  const req = makeReq("127.0.0.1", { "x-forwarded-for": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(
    getViaProxy(req),
    "stamp-tok|1",
    "generic reverse proxy without cf-connecting-ip must set via-proxy=1"
  );
  assert.equal(
    getPeerIp(req),
    "stamp-tok|127.0.0.1",
    "peer-ip must still be the proxy hop for non-Cloudflare proxy"
  );
});

test("deletes any client-supplied peer/via-proxy headers before stamping", () => {
  const req = makeReq("203.0.113.99", {
    [PEER_IP_HEADER]: "forged|1.2.3.4",
    [VIA_PROXY_HEADER]: "forged|1",
  });
  stampPeerIp(req);

  assert.ok(
    !getPeerIp(req)?.startsWith("forged|"),
    "client-supplied peer-ip header must be overwritten"
  );
  assert.ok(
    !getViaProxy(req)?.startsWith("forged|"),
    "client-supplied via-proxy header must be overwritten"
  );
  assert.equal(getPeerIp(req), "stamp-tok|203.0.113.99");
});

test("IPv6 Cloudflare peer is recognized", () => {
  const req = makeReq("2400:cb00::1", { "cf-connecting-ip": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getViaProxy(req), "stamp-tok|1", "IPv6 Cloudflare peer must set via-proxy=1");
});

test("IPv4-mapped peer address is normalized before CF check", () => {
  // 172.71.150.1 is a Cloudflare IPv4 address, sometimes surfaced as ::ffff:...
  const req = makeReq("::ffff:172.71.150.1", { "cf-connecting-ip": "203.0.113.99" });
  stampPeerIp(req);

  assert.equal(getViaProxy(req), "stamp-tok|1", "IPv4-mapped Cloudflare peer must set via-proxy=1");
});

test("F2-01: /0 IPv4 CIDR matches every address", () => {
  assert.equal(matchesIPv4Cidr("8.8.8.8", "0.0.0.0/0"), true, "/0 must match any IPv4 address");
  assert.equal(matchesIPv4Cidr("203.0.113.7", "0.0.0.0/0"), true, "/0 must match any IPv4 address");
});

test("F2-04: /0 IPv6 CIDR matches every address", () => {
  assert.equal(matchesIPv6Cidr("2400:cb00::1", "::/0"), true, "/0 must match any IPv6 address");
  assert.equal(matchesIPv6Cidr("::1", "::/0"), true, "/0 must match any IPv6 address");
});

test("F2-03: full-form IPv4-mapped address is normalized", () => {
  // 172.71.150.1 is inside Cloudflare's 172.64.0.0/13 range.
  assert.equal(
    isCloudflareIP("0:0:0:0:0:ffff:172.71.150.1"),
    true,
    "full-form IPv4-mapped Cloudflare address must be recognized"
  );
  assert.equal(
    isCloudflareIP("0:0:0:0:0:ffff:203.0.113.7"),
    false,
    "full-form IPv4-mapped non-Cloudflare address must not match"
  );
});
