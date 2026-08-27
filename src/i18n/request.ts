import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {LOCALES, DEFAULT_LOCALE} from './config';

/**
 * Normalize compliance event type keys in i18n messages.
 *
 * Some locale JSON files ship raw compliance-event identifiers as keys
 * (e.g. `"account.created"` vs `"accountCreated"`). This helper ensures
 * every key uses the canonical camelCase form so that `next-intl` lookups
 * like `t("accountCreated")` resolve consistently across locales.
 */
export function normalizeComplianceEventTypes(
  messages: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    // Already camelCase or non-dot key → keep as-is
    if (!key.includes('.')) {
      out[key] = typeof value === 'string' ? value : String(value ?? '');
      continue;
    }
    // Convert "section.subsection" → "sectionSubsection"
    const camelKey = key
      .split('.')
      .map((part, i) =>
        i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join('');
    out[camelKey] = typeof value === 'string' ? value : String(value ?? '');
  }
  return out;
}

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !hasLocale(LOCALES, locale)) {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
