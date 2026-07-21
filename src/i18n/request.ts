import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { LOCALES, DEFAULT_LOCALE } from "./config";

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
