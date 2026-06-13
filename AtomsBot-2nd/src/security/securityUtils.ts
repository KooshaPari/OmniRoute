/**
 * Security utility functions for input validation, token validation, and data protection
 */

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates Discord bot token format
 */
export const validateDiscordTokenDetailed = (token: string): SecurityValidationResult => {
  const errors: string[] = [];
  let isValid = true;

  // Basic Discord bot token format validation
  if (!token || token.length < 50) {
    errors.push('Discord token must be at least 50 characters long');
    isValid = false;
  }

  // Discord bot tokens should contain dots
  if (!token.includes('.')) {
    errors.push('Discord token format appears invalid (missing dots)');
    isValid = false;
  }

  return { isValid, errors };
};

/**
 * Simple boolean validator for Discord tokens used by tests
 */
export function validateDiscordToken(token: any): boolean {
  if (!token || typeof token !== 'string') return false;
  if (/^Bot\s+/.test(token)) return false;
  const threePartPattern = /^[A-Za-z0-9+/=]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  const legacyPattern = /^[A-Za-z0-9+/=]{55,65}$/;
  const mfaPattern = /^mfa\.[A-Za-z0-9_-]{40,200}$/;
  if (threePartPattern.test(token) || mfaPattern.test(token) || legacyPattern.test(token)) return true;
  // fallback: accept any token with exactly two dots comprised of safe chars
  if (/^[A-Za-z0-9._\-+/=]+\.[A-Za-z0-9._\-+/=]+\.[A-Za-z0-9._\-+/=]+$/.test(token)) return true;
  return false;
}


/**
 * Validates GitHub token format
 */
export const validateGitHubTokenDetailed = (token: string): SecurityValidationResult => {
  const errors: string[] = [];
  let isValid = true;

  const validPrefixes = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
  if (!token || token.length < 20) {
    errors.push('GitHub token must be at least 20 characters long');
    isValid = false;
  }
  const hasValidPrefix = validPrefixes.some(prefix => token.startsWith(prefix));
  if (!hasValidPrefix) {
    errors.push('GitHub token format appears invalid (missing valid prefix)');
    isValid = false;
  }
  return { isValid, errors };
};

export function validateGitHubToken(token: any): boolean {
  if (!token || typeof token !== 'string') return false;
  const patterns = [
    /^ghp_[A-Za-z0-9]{40}$/,
    /^github_pat_[A-Za-z0-9_]{30,120}$/,
    /^gho_[A-Za-z0-9]{40}$/,
    /^ghu_[A-Za-z0-9]{40}$/,
    /^ghr_[A-Za-z0-9]{40,120}$/,
    /^ghs_[A-Za-z0-9]{40}$/
  ];
  return patterns.some((p) => p.test(token));
}

/**
 * Redacts sensitive information from log messages
 */
export const redactSensitiveData = (message: string): string => {
  let redacted = message;

  // Redact potential tokens
  redacted = redacted.replace(/\bgh[pousr]_[A-Za-z0-9]{36,64}\b/g, '[REDACTED_GITHUB_TOKEN]');
  redacted = redacted.replace(/\bgithub_pat_[A-Za-z0-9_]{70,120}\b/g, '[REDACTED_GITHUB_TOKEN]');

  // Redact Discord tokens (more complex pattern)
  redacted = redacted.replace(/[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/g, '[REDACTED_DISCORD_TOKEN]');
  redacted = redacted.replace(/\bmfa\.[A-Za-z0-9_-]{40,200}\b/g, '[REDACTED_DISCORD_TOKEN]');

  // Redact email addresses
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

  // Redact potential passwords or secrets
  redacted = redacted.replace(/password:\s*\S+/gi, 'password: [REDACTED_PASSWORD]');
  redacted = redacted.replace(/secret:\s*\S+/gi, 'secret: [REDACTED_SECRET]');
  // Generic keys (handle before specialized cases)
  redacted = redacted.replace(/key:\s*\S+/gi, 'key: [REDACTED_KEY]');
  // Stripe-like API keys
  redacted = redacted.replace(/\bsk_[a-zA-Z0-9_]{24,64}\b/g, '[REDACTED_API_KEY]');
  // Explicit API key lines
  redacted = redacted.replace(/\bAPI\s*key:\s*\S+/gi, 'API key: [REDACTED_API_KEY]');

  // Credit cards
  redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CC]');
  // SSN
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

  return redacted;
};

/**
 * Validates and sanitizes file paths to prevent path traversal
 */
export const sanitizeFilePath = (filePath: string): { sanitized: string; isValid: boolean } => {
  // Remove any .. sequences that could lead to path traversal
  const sanitized = filePath.replace(/\.\./g, '').replace(/\/+/g, '/');

  // Check if the original path contained suspicious patterns
  const isValid = !filePath.includes('..') && !filePath.includes('//');

  return { sanitized, isValid };
};

/**
 * Validates input against XSS patterns
 */
export const validateXSS = (input: string): SecurityValidationResult => {
  const errors: string[] = [];
  let isValid = true;

  // Common XSS patterns
  const xssPatterns = [
    /<script[^>]*>.*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially malicious script content');
      isValid = false;
      break;
    }
  }

  return { isValid, errors };
};

/**
 * Validates input against SQL injection patterns
 */
export const validateSQLInjection = (input: string): SecurityValidationResult => {
  const errors: string[] = [];
  let isValid = true;

  // Common SQL injection patterns
  const sqlPatterns = [
    /(\s|^)(union|select|insert|delete|update|drop|create|alter|exec|execute)\s+/gi,
    /(\s|^)(or|and)\s+\d+\s*=\s*\d+/gi,
    /'/gi, // Single quotes are often used in SQL injection
    /--/g, // SQL comments
    /\/\*/g, // SQL block comments
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially malicious SQL content');
      isValid = false;
      break;
    }
  }

  return { isValid, errors };
};

/**
 * Rate limiting interface
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  check(identifier: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    const existing = this.requests.get(identifier);

    if (!existing || existing.resetTime < windowStart) {
      // New window or expired
      this.requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetTime: existing.resetTime };
    }

    existing.count++;
    return { allowed: true, remaining: limit - existing.count, resetTime: existing.resetTime };
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Secure data serialization (prevents prototype pollution)
 */
export const secureSerialize = (data: any): string => {
  return JSON.stringify(data, (key, value) => {
    // Prevent prototype pollution by filtering dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
};

/**
 * Secure data deserialization
 */
export const secureDeserialize = (data: string): any => {
  try {
    const parsed = JSON.parse(data);

    // Remove any dangerous properties
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }

    return parsed;
  } catch {
    throw new Error('Invalid JSON data');
  }
}; 
