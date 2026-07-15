/**
 * Webhook SSRF guard coverage.
 *
 * These tests exercise the URL validation paths that the deliver / create /
 * test endpoints rely on. They run against the shared outbound URL guard so a
 * regression that bypasses `parseAndValidatePublicUrl` at any layer is caught
 * here without requiring a running Next.js server.
 *
 * Run with:
 *   node --import tsx/esm --test tests/unit/webhook-ssrf-guard.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseAndValidatePublicUrl,
  OutboundUrlGuardError,
  isPrivateHost,
} from "../../src/shared/network/outboundUrlGuard.ts";
import { deliverWebhook } from "../../src/lib/webhookDispatcher.ts";

const BLOCKED_URLS = [
  "http://127.0.0.1/internal",
  "http://localhost:20128/api/admin",
  "http://0.0.0.0:8080/",
  "http://[::1]/v1/admin",
  "http://169.254.169.254/latest/meta-data/", // AWS IMDS
  "http://metadata.google.internal/computeMetadata/v1/", // GCP metadata
  "http://10.0.0.1/internal",
  "http://192.168.1.1/admin",
  "http://172.16.0.1/admin",
  "http://172.31.255.255/admin", // RFC 1918 upper bound
  "http://100.64.0.1/", // CGNAT
  "http://[fe80::1]/", // link-local IPv6
  "http://[fea0::1]/", // link-local IPv6 fe80::/10 edge
  "http://[febf:abcd::1]/", // link-local IPv6 fe80::/10 upper bound
  "http://[fc00::1]/", // ULA IPv6 fc00::/7
  "http://[fd00::1]/", // ULA IPv6 fd00::/8
  "http://[fd12:3456:789a::1]/", // ULA IPv6 (full form)
  "http://user:pass@example.com/", // embedded credentials
  "ftp://example.com/path", // forbidden scheme
  "file:///etc/passwd", // forbidden scheme
];

const ALLOWED_URLS = [
  "https://example.com/hooks/abc",
  "https://hooks.slack.com/services/T000/B000/XXXX",
  "https://discord.com/api/webhooks/123/abc",
  "https://api.telegram.org/bot12345:ABCDEF/sendMessage",
  "http://[2001:db8::1]/path", // IPv6 documentation (public)
  "http://[2001:4860:4860::8888]/", // Google DNS IPv6
  "http://[2607:f8b0:4000::1]/", // Google IPv6 range
];

describe("isPrivateHost — RFC1918, loopback, link-local, IMDS coverage", () => {
  it("blocks loopback addresses", () => {
    assert.equal(isPrivateHost("127.0.0.1"), true);
    assert.equal(isPrivateHost("localhost"), true);
    assert.equal(isPrivateHost("::1"), true);
    assert.equal(isPrivateHost("0.0.0.0"), true);
  });

  it("blocks RFC 1918 ranges", () => {
    assert.equal(isPrivateHost("10.0.0.1"), true);
    assert.equal(isPrivateHost("192.168.1.1"), true);
    assert.equal(isPrivateHost("172.16.0.1"), true);
    assert.equal(isPrivateHost("172.31.255.255"), true);
  });

  it("blocks 169.254.x.x link-local (AWS / Azure IMDS)", () => {
    assert.equal(isPrivateHost("169.254.169.254"), true);
    assert.equal(isPrivateHost("169.254.0.1"), true);
  });

  it("blocks CGNAT 100.64.0.0/10", () => {
    assert.equal(isPrivateHost("100.64.0.1"), true);
    assert.equal(isPrivateHost("100.127.255.254"), true);
  });

  it("blocks IPv6 ULA range (fc00::/7)", () => {
    assert.equal(isPrivateHost("fc00::1"), true);
    assert.equal(isPrivateHost("fd00::1"), true);
    assert.equal(isPrivateHost("fd12:3456:789a::1"), true);
    assert.equal(isPrivateHost("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"), true);
  });

  it("blocks IPv6 link-local range (fe80::/10)", () => {
    // fe80::/10 spans fe80: → febf: — verify edges and interior
    assert.equal(isPrivateHost("fe80::1"), true);
    assert.equal(isPrivateHost("fe81::1"), true);
    assert.equal(isPrivateHost("fe90::1"), true);
    assert.equal(isPrivateHost("fea0::1"), true);
    assert.equal(isPrivateHost("feb0::1"), true);
    assert.equal(isPrivateHost("febf:abcd::1"), true);
  });

  it("blocks IPv6 loopback (::1)", () => {
    assert.equal(isPrivateHost("::1"), true);
  });

  it("blocks .localhost and .local suffix hostnames", () => {
    assert.equal(isPrivateHost("svc.localhost"), true);
    assert.equal(isPrivateHost("printer.local"), true);
  });

  it("permits public hostnames and IPs", () => {
    assert.equal(isPrivateHost("example.com"), false);
    assert.equal(isPrivateHost("api.openai.com"), false);
    assert.equal(isPrivateHost("8.8.8.8"), false);
    assert.equal(isPrivateHost("1.1.1.1"), false);
  });

  it("permits public IPv6 addresses", () => {
    assert.equal(isPrivateHost("2001:db8::1"), false); // documentation
    assert.equal(isPrivateHost("2001:4860:4860::8888"), false); // Google DNS
    assert.equal(isPrivateHost("2607:f8b0::1"), false); // Google
    assert.equal(isPrivateHost("2a00:1450:4000::1"), false); // Google UK
  });
});

describe("parseAndValidatePublicUrl — webhook SSRF surface", () => {
  for (const url of BLOCKED_URLS) {
    it(`rejects ${url}`, () => {
      assert.throws(() => parseAndValidatePublicUrl(url), OutboundUrlGuardError);
    });
  }

  for (const url of ALLOWED_URLS) {
    it(`permits ${url}`, () => {
      assert.doesNotThrow(() => parseAndValidatePublicUrl(url));
    });
  }
});

describe("deliverWebhook — runtime SSRF guard returns error without firing fetch", () => {
  it("returns blocked-URL error for private targets, never opens a socket", async () => {
    const res = await deliverWebhook(
      "http://169.254.169.254/latest/meta-data/",
      { event: "test.ping", timestamp: new Date().toISOString(), data: {} },
      "secret"
    );
    assert.equal(res.success, false);
    assert.equal(res.status, 0);
    assert.ok(
      typeof res.error === "string" && /private|blocked|local/i.test(res.error),
      `expected guard error, got: ${res.error}`
    );
  });

  it("returns blocked-URL error for loopback even with valid HMAC secret", async () => {
    const res = await deliverWebhook(
      "http://127.0.0.1:8080/admin",
      { event: "request.failed", timestamp: new Date().toISOString(), data: {} },
      "supersecret"
    );
    assert.equal(res.success, false);
    assert.equal(res.status, 0);
    assert.ok(typeof res.error === "string" && /private|blocked|local/i.test(res.error));
  });

  it("returns blocked-URL error for IPv6 link-local (fe80::/10 edge)", async () => {
    const res = await deliverWebhook(
      "http://[fea0::1]:8080/hook",
      { event: "test.ping", timestamp: new Date().toISOString(), data: {} },
      null
    );
    assert.equal(res.success, false);
    assert.equal(res.status, 0);
    assert.ok(
      typeof res.error === "string" && /private|blocked|local/i.test(res.error),
      `expected guard error for fea0::1, got: ${res.error}`
    );
  });

  it("returns blocked-URL error for IPv6 ULA (fd00::/8 edge)", async () => {
    const res = await deliverWebhook(
      "http://[fd00::1]:8080/hook",
      { event: "test.ping", timestamp: new Date().toISOString(), data: {} },
      null
    );
    assert.equal(res.success, false);
    assert.equal(res.status, 0);
    assert.ok(
      typeof res.error === "string" && /private|blocked|local/i.test(res.error),
      `expected guard error for fd00::1, got: ${res.error}`
    );
  });

  it("returns blocked-URL error for IPv6 loopback", async () => {
    const res = await deliverWebhook(
      "http://[::1]:20128/admin",
      { event: "test.ping", timestamp: new Date().toISOString(), data: {} },
      null
    );
    assert.equal(res.success, false);
    assert.equal(res.status, 0);
    assert.ok(
      typeof res.error === "string" && /private|blocked|local/i.test(res.error),
      `expected guard error for ::1, got: ${res.error}`
    );
  });
});
