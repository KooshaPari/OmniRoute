/** Parse BFF_CORS_ORIGINS into a bounded allowlist of absolute http(s) origins. */
export function parseCorsOrigins(raw: string): string[] {
  const origins = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      try {
        const url = new URL(part);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        if (url.username || url.password) return null;
        return url.origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null);

  return [...new Set(origins)];
}
