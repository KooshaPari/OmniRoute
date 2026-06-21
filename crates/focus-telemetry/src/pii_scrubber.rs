// SPDX-License-Identifier: MIT OR Apache-2.0

//! # PII Scrubber — Shared with SentryPrivacyFilter
//!
//! Implements the same redaction patterns as the iOS Sentry integration (commit 5a4ab69).
//! Ensures consistent PII handling across all observability channels.

use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

/// Shared PII scrubbing patterns — reused from SentryPrivacyFilter.
pub struct PiiScrubber {
    email_regex: &'static Regex,
    phone_regex: &'static Regex,
    token_regex: &'static Regex,
    uuid_regex: &'static Regex,
    healthkit_regex: &'static Regex,
}

impl PiiScrubber {
    pub fn new() -> Self {
        Self {
            email_regex: email_pattern(),
            phone_regex: phone_pattern(),
            token_regex: token_pattern(),
            uuid_regex: uuid_pattern(),
            healthkit_regex: healthkit_pattern(),
        }
    }

    /// Scrub a JSON object recursively for PII.
    pub fn scrub_json(&self, value: Value) -> Value {
        match value {
            Value::String(s) => Value::String(self.scrub_string(&s)),
            Value::Object(map) => {
                let mut scrubbed = serde_json::Map::new();
                for (k, v) in map {
                    scrubbed.insert(k, self.scrub_json(v));
                }
                Value::Object(scrubbed)
            }
            Value::Array(arr) => {
                Value::Array(arr.into_iter().map(|v| self.scrub_json(v)).collect())
            }
            other => other,
        }
    }

    /// Scrub PII from a string using all regex patterns.
    fn scrub_string(&self, input: &str) -> String {
        let mut result = input.to_string();

        // Order matters: scrub more specific/longer patterns first to avoid partial matches
        result = self.uuid_regex.replace_all(&result, "[REDACTED_UUID]").to_string();
        result = self.email_regex.replace_all(&result, "[REDACTED_EMAIL]").to_string();
        result = self.token_regex.replace_all(&result, "[REDACTED_TOKEN]").to_string();
        result = self.phone_regex.replace_all(&result, "[REDACTED_PHONE]").to_string();
        result = self
            .healthkit_regex
            .replace_all(&result, "[REDACTED_HEALTHKIT]")
            .to_string();

        result
    }
}

impl Default for PiiScrubber {
    fn default() -> Self {
        Self::new()
    }
}

/// Email pattern: user@domain.com
fn email_pattern() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap()
    })
}

/// Phone pattern: (555) 555-0123, +1-555-0124, etc.
fn phone_pattern() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        // Match phone patterns like (555) 555-0123, 555-555-0123, +1-555-555-0123
        Regex::new(
            r"(?:\+\d{1,3})?[-.\s]?\(?(?:0\d{1}|[1-9]\d{0,2})\)?[-.\s]?\d{3,4}[-.\s]?\d{4}",
        )
        .unwrap()
    })
}

/// OAuth/API token pattern: "Bearer sk_live_...", "Authorization: ...", etc.
fn token_pattern() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?i)(?:bearer|token|authorization|api[._-]?key|secret|key|password)\s*[:=\s]+([a-zA-Z0-9._\-]{20,})").unwrap()
    })
}

/// UUID pattern: 550e8400-e29b-41d4-a716-446655440000
fn uuid_pattern() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
            .unwrap()
    })
}

/// HealthKit pattern: heart rate, blood pressure, glucose, etc.
fn healthkit_pattern() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r"(heart[._-]?rate|blood[._-]?pressure|glucose|oxygen|temperature|weight|height|steps|distance)",
        )
        .unwrap()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_scrub_email() {
        let scrubber = PiiScrubber::new();
        assert_eq!(
            scrubber.scrub_string("contact: alice@example.com"),
            "contact: [REDACTED_EMAIL]"
        );
    }

    #[test]
    fn test_scrub_phone() {
        let scrubber = PiiScrubber::new();
        let result = scrubber.scrub_string("call (555) 555-0123 now");
        assert!(result.contains("[REDACTED_PHONE]"));
    }

    #[test]
    fn test_scrub_token() {
        let scrubber = PiiScrubber::new();
        let result = scrubber.scrub_string("Bearer sk_live_abc123def456xyz");
        assert!(result.contains("[REDACTED_TOKEN]"));
    }

    #[test]
    fn test_scrub_uuid() {
        let scrubber = PiiScrubber::new();
        assert_eq!(
            scrubber.scrub_string("task 550e8400-e29b-41d4-a716-446655440000"),
            "task [REDACTED_UUID]"
        );
    }

    #[test]
    fn test_scrub_json_recursive() {
        let scrubber = PiiScrubber::new();
        let input = json!({
            "email": "test@example.com",
            "nested": {
                "phone": "(555) 555-0123"
            },
            "array": ["alice@example.com", "safe_string"]
        });

        let output = scrubber.scrub_json(input);

        assert_eq!(
            output.get("email").and_then(|v| v.as_str()),
            Some("[REDACTED_EMAIL]")
        );
        assert_eq!(
            output.get("nested")
                .and_then(|v| v.get("phone"))
                .and_then(|v| v.as_str()),
            Some("[REDACTED_PHONE]")
        );

        let arr = output.get("array").and_then(|v| v.as_array()).unwrap();
        assert_eq!(arr[0].as_str(), Some("[REDACTED_EMAIL]"));
        assert_eq!(arr[1].as_str(), Some("safe_string"));
    }

    #[test]
    fn test_scrub_multiple_patterns_in_one_string() {
        let scrubber = PiiScrubber::new();
        let input = "Email alice@example.com, phone (555) 555-0123, token Bearer sk_live_abc123def456";
        let output = scrubber.scrub_string(input);

        assert!(output.contains("[REDACTED_EMAIL]"));
        assert!(output.contains("[REDACTED_PHONE]"));
        assert!(output.contains("[REDACTED_TOKEN]"));
    }
}
