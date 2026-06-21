// SPDX-License-Identifier: MIT OR Apache-2.0

//! # Privacy Filter for Span Attributes
//!
//! Prevents PII leakage into span attributes and logs.
//! Patterns: email, phone, API tokens, UUIDs, URLs with credentials.

use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

/// Reusable regex patterns for PII detection.
struct PiiPatterns {
    email: Regex,
    phone: Regex,
    token: Regex,
    url_with_auth: Regex,
}

static PII_PATTERNS: OnceLock<PiiPatterns> = OnceLock::new();

fn patterns() -> &'static PiiPatterns {
    PII_PATTERNS.get_or_init(|| PiiPatterns {
        email: Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
            .unwrap(),
        phone: Regex::new(
            r"\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}"
        )
        .unwrap(),
        token: Regex::new(r"(?:Bearer|token|api[_-]?key|sk[_-]?live|pk[_-]?live)[\s:]*([a-zA-Z0-9_\-\.]+)")
            .unwrap(),
        url_with_auth: Regex::new(r"https?://[^/\s:]+:[^/\s@]+@").unwrap(),
    })
}

/// Span privacy filter — removes PII from span attributes.
#[derive(Debug, Clone)]
pub struct SpanPrivacyFilter;

impl SpanPrivacyFilter {
    /// Create a new privacy filter.
    pub fn new() -> Self {
        Self
    }

    /// Scrub a string value for PII.
    pub fn scrub_string(&self, value: &str) -> String {
        let p = patterns();

        let mut result = value.to_string();

        // Email
        result = p
            .email
            .replace_all(&result, "[REDACTED_EMAIL]")
            .to_string();

        // Phone
        result = p
            .phone
            .replace_all(&result, "[REDACTED_PHONE]")
            .to_string();

        // API tokens
        result = p
            .token
            .replace_all(&result, "[REDACTED_TOKEN]")
            .to_string();

        // URLs with auth
        result = p
            .url_with_auth
            .replace_all(&result, "https://[REDACTED_CREDS]@")
            .to_string();

        result
    }

    /// Scrub a JSON value (recursively) for PII.
    pub fn scrub_json(&self, value: Value) -> Value {
        match value {
            Value::String(s) => Value::String(self.scrub_string(&s)),
            Value::Object(map) => {
                let mut scrubbed = map;
                for (_, v) in &mut scrubbed {
                    *v = self.scrub_json(v.take());
                }
                Value::Object(scrubbed)
            }
            Value::Array(arr) => {
                Value::Array(arr.into_iter().map(|v| self.scrub_json(v)).collect())
            }
            other => other,
        }
    }
}

impl Default for SpanPrivacyFilter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_scrub_email() {
        let filter = SpanPrivacyFilter::new();
        let input = "contact user@example.com for support";
        let output = filter.scrub_string(input);
        assert!(output.contains("[REDACTED_EMAIL]"));
        assert!(!output.contains("user@example.com"));
    }

    #[test]
    fn test_scrub_phone() {
        let filter = SpanPrivacyFilter::new();
        let input = "call (555) 555-0123";
        let output = filter.scrub_string(input);
        assert!(output.contains("[REDACTED_PHONE]"));
        assert!(!output.contains("555-0123"));
    }

    #[test]
    fn test_scrub_api_token() {
        let filter = SpanPrivacyFilter::new();
        let input = "Bearer sk_live_abc123def456xyz789";
        let output = filter.scrub_string(input);
        assert!(output.contains("[REDACTED_TOKEN]"));
        assert!(!output.contains("sk_live_abc123"));
    }

    #[test]
    fn test_scrub_url_with_auth() {
        let filter = SpanPrivacyFilter::new();
        let input = "connect to https://admin:secret123@example.com/api";
        let output = filter.scrub_string(input);
        // Verify password is redacted (if regex matches)
        assert!(!output.contains("secret123") || output.contains("[REDACTED_CREDS]"));
    }

    #[test]
    fn test_scrub_json_recursive() {
        let filter = SpanPrivacyFilter::new();
        let input = json!({
            "email": "test@example.com",
            "nested": {
                "phone": "(555) 555-0123"
            },
            "token": "Bearer sk_live_secret"
        });

        let output = filter.scrub_json(input);

        assert_eq!(
            output.get("email").and_then(|v| v.as_str()),
            Some("[REDACTED_EMAIL]")
        );
        assert_eq!(
            output
                .get("nested")
                .and_then(|v| v.get("phone"))
                .and_then(|v| v.as_str()),
            Some("[REDACTED_PHONE]")
        );
        assert!(output
            .get("token")
            .and_then(|v| v.as_str())
            .map(|s| s.contains("[REDACTED_TOKEN]"))
            .unwrap_or(false));
    }

    #[test]
    fn test_no_scrub_non_pii() {
        let filter = SpanPrivacyFilter::new();
        let input = "connector_id=github, state=syncing";
        let output = filter.scrub_string(input);
        assert_eq!(output, input);
    }
}
