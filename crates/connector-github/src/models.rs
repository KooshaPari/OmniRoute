// SPDX-License-Identifier: MIT OR Apache-2.0

//! GitHub REST domain types — minimal subset of `/user` and `/users/{login}/events`.
//!
//! Field names match the GitHub REST v3 / 2022-11-28 API. We model only what
//! the connector maps into focus-events; everything else is either ignored
//! via serde's default behaviour for untagged extra fields or dropped into
//! the untyped `payload` passthrough.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// `GET /user` response (the authenticated user).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    #[serde(default)]
    pub name: Option<String>,
}

/// `GET /users/{login}/events` item.
///
/// GitHub wraps the polymorphic event body in `payload` whose shape depends
/// on `type`. We keep `payload` as a raw JSON value and pick it apart in the
/// event mapper — this keeps the model stable even as GitHub evolves event
/// shapes (they change more often than the `type` enum).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub actor: GitHubActor,
    pub repo: GitHubRepo,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub public: bool,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubActor {
    pub id: u64,
    pub login: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
}

/// `GET /user/repos` response item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub owner: GitHubActor,
    pub private: bool,
    pub pushed_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub language: Option<String>,
    pub stargazers_count: u32,
}

/// `GET /issues` response item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub id: u64,
    pub number: u32,
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    pub state: String,
    pub user: GitHubActor,
    pub repository_url: String,
    pub html_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `GET /repos/{owner}/{repo}/pulls/{number}` response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPullRequest {
    pub id: u64,
    pub number: u32,
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    pub state: String,
    pub user: GitHubActor,
    pub merged: bool,
    #[serde(default)]
    pub merged_at: Option<DateTime<Utc>>,
    pub html_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub review_comments: u32,
}

/// `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` response item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubCheckRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    #[serde(default)]
    pub conclusion: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub html_url: String,
}

/// `GET /repos/{owner}/{repo}/actions/runs` response item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubWorkflowRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    #[serde(default)]
    pub conclusion: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub html_url: String,
}

/// GraphQL response for contribution calendar query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubContributionDay {
    pub date: String,
    pub contribution_count: u32,
}

/// Wrapper for paginated lists.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPaginatedList<T> {
    #[serde(default)]
    pub total_count: u32,
    pub items: Vec<T>,
}
