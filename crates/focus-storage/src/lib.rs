// SPDX-License-Identifier: MIT OR Apache-2.0

#![deny(missing_docs)]

//! Storage ports + SQLite impls.

/// Storage abstraction ports and trait definitions.
pub mod ports {
    use async_trait::async_trait;

    /// Append-only event store port.
    #[async_trait]
    pub trait EventStore: Send + Sync {
        /// Append an event to the store.
        async fn append(&self, event: focus_events::NormalizedEvent) -> anyhow::Result<()>;
        /// Retrieve events starting from a cursor position.
        async fn since_cursor(
            &self,
            cursor: Option<&str>,
            limit: usize,
        ) -> anyhow::Result<Vec<focus_events::NormalizedEvent>>;
    }

    /// Rule store port for rule queries and mutations.
    #[async_trait]
    pub trait RuleStore: Send + Sync {
        /// Fetch a rule by ID.
        async fn get(&self, id: uuid::Uuid) -> anyhow::Result<Option<focus_rules::Rule>>;
        /// List all enabled rules.
        async fn list_enabled(&self) -> anyhow::Result<Vec<focus_rules::Rule>>;
    }

    /// Wallet store port for reward state persistence.
    #[async_trait]
    pub trait WalletStore: Send + Sync {
        /// Load a user's reward wallet.
        async fn load(&self, user_id: uuid::Uuid) -> anyhow::Result<focus_rewards::RewardWallet>;
        /// Apply a mutation to a user's wallet.
        async fn apply(
            &self,
            user_id: uuid::Uuid,
            mutation: focus_rewards::WalletMutation,
        ) -> anyhow::Result<()>;
    }

    /// Re-export of the sync [`focus_planning::TaskStore`] port so callers
    /// routing through `focus_storage::ports` find it alongside the other
    /// store traits. Canonical definition lives in `focus-planning` to keep
    /// the domain type colocated with its persistence surface.
    pub use focus_planning::TaskStore;

    /// Penalty store port for penalty state persistence.
    #[async_trait]
    pub trait PenaltyStore: Send + Sync {
        /// Load a user's penalty state.
        async fn load(&self, user_id: uuid::Uuid) -> anyhow::Result<focus_penalties::PenaltyState>;
        /// Apply a mutation to a user's penalty state.
        async fn apply(
            &self,
            user_id: uuid::Uuid,
            mutation: focus_penalties::PenaltyMutation,
        ) -> anyhow::Result<()>;
    }
}

/// SQLite adapter implementation of storage ports.
pub mod sqlite;
/// Right-to-erasure (GDPR account deletion) operations.
pub mod wipe;

pub use sqlite::SqliteAdapter;
pub use wipe::{wipe_all, WipeReceipt};
