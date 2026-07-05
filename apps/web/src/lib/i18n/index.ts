// Lightweight runtime i18n wrapper. The Paraglide JS generated client is heavier
// and would be wired in once `bun run i18n:compile` produces ./paraglide/. For
// now we ship a hand-rolled loader that handles the seed locales + English
// fallback for the remaining 38 (which contain `_note` only).

import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';

const messages: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  fr: fr as Record<string, string>,
  de: de as Record<string, string>,
};

const RTL = new Set(['ar', 'he', 'fa', 'ur']);

let current = $state<string>('en');

export function setLocale(lang: string) {
  if (messages[lang]) current = lang;
  else current = 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    document.documentElement.dir = RTL.has(current) ? 'rtl' : 'ltr';
  }
}

export function getLocale(): string {
  return current;
}

export function isRTL(lang: string = current): boolean {
  return RTL.has(lang);
}

export function t(key: string, fallback?: string): string {
  return messages[current]?.[key] ?? messages.en?.[key] ?? fallback ?? key;
}

export const availableLocales = Object.keys(messages);
export const supportedLanguages = [
  'en', 'zh-CN', 'ja', 'ko', 'de', 'fr', 'es', 'pt-BR', 'ru', 'ar', 'he',
  'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'hi', 'uk', 'cs', 'sv',
  'no', 'da', 'fi', 'el', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'sr',
  'lt', 'lv', 'et', 'is', 'ga', 'mt', 'cy', 'eu', 'ca', 'gl', 'lb',
];
