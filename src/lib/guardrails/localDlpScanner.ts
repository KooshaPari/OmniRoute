export type DlpCategory =
  | "aws_access_key"
  | "private_key"
  | "bearer_token"
  | "api_secret_assignment"
  | "email"
  | "us_ssn"
  | "credit_card";

export interface DlpMatch {
  category: DlpCategory;
  start: number;
  end: number;
  rule: string;
}

export interface DlpScanResult {
  categories: string[];
  matches: DlpMatch[];
  redactedText: string;
}

interface Rule {
  category: DlpCategory;
  name: string;
  regex: RegExp;
  validate?: (value: string) => boolean;
}

const AWS_ACCESS_KEY = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const PEM_PRIVATE_KEY_HEADER = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g;
const BEARER_TOKEN = /\bBearer\s+([A-Za-z0-9._~+/-]{16,}={0,2})\b/gi;
const SECRET_ASSIGNMENT =
  /\b(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*["']?([A-Za-z0-9._~+/-]{16,}={0,2})["']?/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const US_SSN = /\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g;
const CARD_LIKE_NUMBER = /\b(?:\d[ -]*?){13,19}\b/g;

function isLuhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

// Earlier rules win on overlap, which also makes email/credential matches hide
// weaker card-shaped substrings when a detector covers a larger meaningful span.
const RULES: readonly Rule[] = [
  { category: "aws_access_key", name: "aws_access_key_id", regex: AWS_ACCESS_KEY },
  { category: "private_key", name: "pem_private_key_header", regex: PEM_PRIVATE_KEY_HEADER },
  { category: "bearer_token", name: "bearer_token", regex: BEARER_TOKEN },
  { category: "api_secret_assignment", name: "secret_assignment", regex: SECRET_ASSIGNMENT },
  { category: "email", name: "email_address", regex: EMAIL },
  { category: "us_ssn", name: "us_ssn", regex: US_SSN },
  { category: "credit_card", name: "luhn_card_number", regex: CARD_LIKE_NUMBER, validate: isLuhnValid },
];

export function scanLocalDlp(text: string): DlpScanResult {
  const candidates: DlpMatch[] = [];

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    for (const match of text.matchAll(rule.regex)) {
      const value = match[1] ?? match[0];
      if (rule.validate && !rule.validate(value)) continue;
      const start = match.index;
      const end = start + match[0].length;
      candidates.push({ category: rule.category, start, end, rule: rule.name });
    }
  }

  candidates.sort((left, right) =>
    left.start - right.start || right.end - left.end || RULES.findIndex((rule) => rule.name === left.rule) - RULES.findIndex((rule) => rule.name === right.rule)
  );

  const matches: DlpMatch[] = [];
  let occupiedUntil = -1;
  for (const candidate of candidates) {
    if (candidate.start < occupiedUntil) continue;
    matches.push(candidate);
    occupiedUntil = candidate.end;
  }

  const categories: string[] = [];
  for (const match of matches) {
    if (!categories.includes(match.category)) categories.push(match.category);
  }

  let redactedText = "";
  let cursor = 0;
  for (const match of matches) {
    redactedText += text.slice(cursor, match.start);
    redactedText += `[REDACTED:${match.category}]`;
    cursor = match.end;
  }
  redactedText += text.slice(cursor);

  return { categories, matches, redactedText };
}

export function redactLocalDlp(text: string): string {
  return scanLocalDlp(text).redactedText;
}
