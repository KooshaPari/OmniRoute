const ADOBE_JWT_IN_TEXT_REGEX =
  /eyJ[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}/;
const ADOBE_JWT_IN_TEXT_GLOBAL_REGEX =
  /eyJ[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}/g;
const ADOBE_JWT_EXACT_REGEX =
  /^eyJ[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}$/;
const FIREFLY_3P_HOST_SUFFIX = "firefly-3p.ff.adobe.io";

export function decodeAdobeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    let raw = String(token || "")
      .trim()
      .replace(/^bearer\s+/i, "")
      .trim();
    const match = raw.match(ADOBE_JWT_IN_TEXT_REGEX);
    if (match) raw = match[0];
    const part = raw.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function findAllAdobeJwts(value: string): string[] {
  return value.match(ADOBE_JWT_IN_TEXT_GLOBAL_REGEX) ?? [];
}

export function isExactAdobeJwt(value: string): boolean {
  return ADOBE_JWT_EXACT_REGEX.test(value);
}

export function stripAdobeJwts(value: string, replacement = ""): string {
  return value.replace(ADOBE_JWT_IN_TEXT_GLOBAL_REGEX, replacement);
}

function hostnameMatches(hostname: string, expected: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === expected || normalized.endsWith(`.${expected}`);
}

export function isAdobeFireflyApiUrl(rawUrl: string): boolean {
  try {
    return hostnameMatches(new URL(rawUrl).hostname, FIREFLY_3P_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function isAdobeLoginCookieDomain(domain: string): boolean {
  return hostnameMatches(domain.replace(/^\./, ""), "adobelogin.com");
}
