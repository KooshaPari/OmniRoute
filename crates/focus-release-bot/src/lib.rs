// SPDX-License-Identifier: MIT OR Apache-2.0

//! Discord webhook poster for FocalPoint release notes.
//!
//! Posts release notes to a Discord webhook as formatted embeds.
//! Webhook URL is passed at runtime; never stored in code.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BotError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Invalid webhook URL")]
    InvalidWebhookUrl,

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::error::Error),

    #[error("Webhook error: {0}")]
    WebhookError(String),
}

/// Represents a single Discord embed field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedField {
    pub name: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline: Option<bool>,
}

/// Discord embed for release notes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Embed {
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<i32>,
    pub fields: Vec<EmbedField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footer: Option<EmbedFooter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedFooter {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// Discord message payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordMessage {
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub embeds: Vec<Embed>,
}

/// Release notes grouped by category.
#[derive(Debug, Clone)]
pub struct ReleaseNotesPayload {
    pub version: String,
    pub categories: BTreeMap<String, Vec<String>>,
}

impl ReleaseNotesPayload {
    /// Create a new release notes payload.
    pub fn new(version: impl Into<String>) -> Self {
        Self {
            version: version.into(),
            categories: BTreeMap::new(),
        }
    }

    /// Add notes for a category.
    pub fn with_category(mut self, name: impl Into<String>, items: Vec<String>) -> Self {
        self.categories.insert(name.into(), items);
        self
    }

    /// Convert to Discord message format.
    pub fn to_discord_message(self) -> DiscordMessage {
        let mut content = format!("🎉 **FocalPoint {}** Release\n", self.version);

        let mut fields = Vec::new();

        let category_emojis = [
            ("Added", "✨"),
            ("Fixed", "🐛"),
            ("Performance", "⚡"),
            ("Documentation", "📚"),
            ("Tests", "✅"),
            ("Changed", "🔄"),
        ];

        for (cat_name, emoji) in &category_emojis {
            if let Some(items) = self.categories.get(*cat_name) {
                let value = items
                    .iter()
                    .map(|item| format!("• {}", item))
                    .collect::<Vec<_>>()
                    .join("\n");
                fields.push(EmbedField {
                    name: format!("{} {}", emoji, cat_name),
                    value,
                    inline: Some(false),
                });
            }
        }

        content.push_str("See below for details.");

        let embed = Embed {
            title: format!("FocalPoint {}", self.version),
            description: "Community-powered screen time management".to_string(),
            color: Some(0x6366f1), // Indigo
            fields,
            footer: Some(EmbedFooter {
                text: "Give us feedback in #feedback or on GitHub!".to_string(),
                icon_url: None,
            }),
        };

        DiscordMessage {
            content,
            embeds: vec![embed],
        }
    }
}

/// Post release notes to a Discord webhook.
pub async fn post_to_webhook(
    webhook_url: &str,
    payload: ReleaseNotesPayload,
) -> Result<(), BotError> {
    if !webhook_url.starts_with("https://discord.com/api/webhooks/") {
        return Err(BotError::InvalidWebhookUrl);
    }

    let message = payload.to_discord_message();
    let client = reqwest::Client::new();

    let response = client
        .post(webhook_url)
        .json(&message)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(BotError::WebhookError(format!(
            "Discord webhook failed with status {}: {}",
            response.status(),
            webhook_url
        )));
    }

    Ok(())
}

/// Synchronous version of post_to_webhook (for CLI use).
pub fn post_to_webhook_blocking(
    webhook_url: &str,
    payload: ReleaseNotesPayload,
) -> Result<(), BotError> {
    if !webhook_url.starts_with("https://discord.com/api/webhooks/") {
        return Err(BotError::InvalidWebhookUrl);
    }

    let message = payload.to_discord_message();
    let client = reqwest::blocking::Client::new();

    let response = client
        .post(webhook_url)
        .json(&message)
        .send()?;

    if !response.status().is_success() {
        return Err(BotError::WebhookError(format!(
            "Discord webhook failed with status {}: {}",
            response.status(),
            webhook_url
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_release_notes_serialization() {
        let payload = ReleaseNotesPayload::new("0.0.4")
            .with_category(
                "Added",
                vec!["New release notes generator".to_string()],
            )
            .with_category("Fixed", vec!["CLI formatting".to_string()]);

        let msg = payload.to_discord_message();
        assert_eq!(msg.embeds.len(), 1);
        assert!(msg.content.contains("0.0.4"));

        let json = serde_json::to_string(&msg).expect("serialization failed");
        assert!(json.contains("✨"));
        assert!(json.contains("Added"));
    }

    #[test]
    fn test_discord_message_structure() {
        let payload = ReleaseNotesPayload::new("0.0.4");
        let msg = payload.to_discord_message();

        assert!(!msg.embeds.is_empty());
        let embed = &msg.embeds[0];
        assert_eq!(embed.title, "FocalPoint 0.0.4");
        assert_eq!(embed.color, Some(0x6366f1));
        assert!(embed.footer.is_some());
    }

    #[test]
    fn test_invalid_webhook_url() {
        let payload = ReleaseNotesPayload::new("0.0.4");
        let result = post_to_webhook_blocking("https://example.com/not-a-webhook", payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_embed_field_json() {
        let field = EmbedField {
            name: "Added".to_string(),
            value: "• New feature".to_string(),
            inline: Some(false),
        };
        let json = serde_json::to_string(&field).expect("serialization failed");
        assert!(json.contains("Added"));
        assert!(json.contains("inline"));
    }
}
