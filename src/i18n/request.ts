import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from "./config";
import type { Locale } from "./config";

<<<<<<< Updated upstream
const UNSAFE_DOTTED_KEY_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function assignDottedKey(target: Record<string, unknown>, dottedKey: string, value: unknown) {
  const segments = dottedKey.split(".");
  if (segments.some((segment) => !segment || UNSAFE_DOTTED_KEY_SEGMENTS.has(segment))) {
    return;
  }

  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

export function normalizeComplianceEventTypes(messages: Record<string, unknown>) {
  const clone = structuredClone(messages);
  const eventTypes = (clone as any)?.compliance?.eventTypes;
  if (!eventTypes || typeof eventTypes !== "object" || Array.isArray(eventTypes)) {
    return clone;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(eventTypes)) {
    if (key.includes(".")) {
      assignDottedKey(normalized, key, value);
    } else {
      normalized[key] = value;
    }
  }
  (clone as any).compliance.eventTypes = normalized;
  return clone;
}

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
=======
export default getRequestConfig(async () => {
  // 1. Try cookie
  const cookieStore = await cookies();
  let locale: string = cookieStore.get(LOCALE_COOKIE)?.value || "";
>>>>>>> Stashed changes

  // 2. Try custom header (set by middleware)
  if (!locale) {
    const headerStore = await headers();
    locale = headerStore.get("x-locale") || "";
  }

  // 3. Validate & fallback
  if (!LOCALES.includes(locale as Locale)) {
    locale = DEFAULT_LOCALE;
  }

  const messages = (await import(`./messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
