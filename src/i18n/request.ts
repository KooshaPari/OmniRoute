import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from "./config";
import type { Locale } from "./config";

const FALLBACK_LOCALE = "en";

/**
 * Sentinel prefix written by `scripts/i18n/sync-ui-keys.mjs` when backfilling a
 * locale file with an untranslated key: `__MISSING__:<english value>`. Kept in
 * sync manually with the scripts (plain .mjs, no shared TS module) — see
 * `scripts/i18n/sync-ui-keys.mjs` and `scripts/i18n/check-ui-keys-coverage.mjs`.
 */
export const PLACEHOLDER_PREFIX = "__MISSING__:";

function isUntranslatedPlaceholder(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PLACEHOLDER_PREFIX);
}

/**
 * Deep merge that mutates `target` with values from `source`.
 * If both have an object at the same key, recurse.
 * Otherwise prefer the existing value in `target` (locale-specific wins) —
 * unless the target value is an untranslated `__MISSING__:` sentinel written
 * by the i18n sync script, in which case it is treated as absent so the
 * clean English fallback value wins instead (#7258).
 */
export function deepMergeFallback(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  for (const [key, sourceValue] of Object.entries(source)) {
    // Guard against prototype pollution from a crafted locale message tree.
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const targetValue = target[key];
    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      deepMergeFallback(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
    } else if (targetValue === undefined || isUntranslatedPlaceholder(targetValue)) {
      target[key] = sourceValue;
    }
  }
  return target;
}

function setNestedValue(target: Record<string, unknown>, dottedKey: string, value: unknown): void {
  const segments = dottedKey.split(".").filter(Boolean);
  if (segments.length === 0) return;

  let cursor = target;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const existing = cursor[segment];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      cursor = existing as Record<string, unknown>;
    } else {
      const nested: Record<string, unknown> = {};
      cursor[segment] = nested;
      cursor = nested;
    }
  }
}

export function normalizeComplianceEventTypes(
  messages: Record<string, unknown>
): Record<string, unknown> {
  const compliance = messages.compliance;
  if (!compliance || typeof compliance !== "object" || Array.isArray(compliance)) return messages;
  const eventTypes = (compliance as Record<string, unknown>).eventTypes;
  if (!eventTypes || typeof eventTypes !== "object" || Array.isArray(eventTypes)) return messages;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(eventTypes)) {
    if (key.includes(".")) setNestedValue(normalized, key, value);
    else normalized[key] = value;
  }
  return {
    ...messages,
    compliance: { ...(compliance as Record<string, unknown>), eventTypes: normalized },
  };
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !hasLocale(LOCALES, locale)) {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: normalizeComplianceEventTypes(
      (await import(`./messages/${locale}.json`)).default as Record<string, unknown>
    ),
  };
});
