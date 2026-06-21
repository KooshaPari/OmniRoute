// SPDX-License-Identifier: MIT OR Apache-2.0

//! Canvas LMS domain types. JSON field names match Canvas API.
//!
//! Optional fields lean heavily on `#[serde(default)]`: Canvas API responses
//! vary by endpoint, account permissions, and feature flags. Fields that are
//! documented as optional OR that Canvas is observed to omit in practice are
//! wrapped in `Option`/`Vec`/`String` defaults rather than required.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Course {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub workflow_state: String,
    #[serde(default)]
    pub enrollment_term_id: Option<u64>,
    #[serde(default)]
    pub course_code: Option<String>,
    #[serde(default)]
    pub start_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub end_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Assignment {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub unlock_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub lock_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub submission_types: Vec<String>,
    #[serde(default)]
    pub points_possible: Option<f64>,
    /// Canvas omits `course_id` on some listings (e.g.
    /// `/courses/:id/assignments`). The caller threads the parent course id
    /// through the event mapper instead of relying on this field.
    #[serde(default)]
    pub course_id: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Submission {
    pub id: u64,
    #[serde(default)]
    pub submitted_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub graded_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub workflow_state: String,
    #[serde(default)]
    pub score: Option<f64>,
    #[serde(default)]
    pub grade: Option<String>,
    pub assignment_id: u64,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub late: Option<bool>,
    #[serde(default)]
    pub missing: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanvasUser {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub locale: Option<String>,
}

/// Canvas announcement (a DiscussionTopic with `is_announcement=true`).
/// Fetched from `/api/v1/announcements?context_codes[]=course_<id>`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Announcement {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub posted_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub delayed_post_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub html_url: Option<String>,
    /// Canvas returns context info in a few shapes; we only surface the
    /// string form when present. The mapper threads the known course id
    /// through instead of trusting this field.
    #[serde(default)]
    pub context_code: Option<String>,
}

/// Canvas course progress. Fetched from `/api/v1/users/:user_id/courses/:course_id/progress`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CourseProgress {
    #[serde(default)]
    pub progress: Option<f64>,
    #[serde(default)]
    pub requirement_count: Option<u64>,
    #[serde(default)]
    pub requirement_completed_count: Option<u64>,
    #[serde(default)]
    pub next_requirement_url: Option<String>,
}

/// Canvas enrollment (student in course). Fetched from `/api/v1/courses/:course_id/users`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Enrollment {
    pub id: u64,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub course_id: Option<u64>,
    #[serde(default)]
    pub type_field: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub enrollment_state: Option<String>,
    #[serde(default)]
    pub user: Option<CanvasUser>,
}

/// Canvas calendar event. Fetched from `/api/v1/calendar_events?context_codes[]=course_X`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CalendarEvent {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub start_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub end_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub location_name: Option<String>,
    #[serde(default)]
    pub context_code: Option<String>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub all_day: Option<bool>,
    /// Some canvas instances return this; indicates if event is assignment-backed.
    #[serde(default)]
    pub assignment_id: Option<u64>,
}

/// Canvas user grade summary. Fetched from `/api/v1/users/self/grades`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserGrade {
    #[serde(default)]
    pub enrollment_id: Option<u64>,
    #[serde(default)]
    pub current_score: Option<f64>,
    #[serde(default)]
    pub final_score: Option<f64>,
    #[serde(default)]
    pub current_grade: Option<String>,
    #[serde(default)]
    pub final_grade: Option<String>,
}

/// Canvas discussion topic. Fetched from `/api/v1/courses/:id/discussion_topics`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscussionTopic {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub posted_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub last_reply_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub discussion_subentry_count: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub is_announcement: Option<bool>,
}

/// Canvas discussion entry (reply). Fetched from `/api/v1/courses/:id/discussion_topics/:topic_id/entries`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiscussionEntry {
    pub id: u64,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub rating_count: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas quiz. Fetched from `/api/v1/courses/:id/quizzes`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Quiz {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub unlock_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub lock_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub points_possible: Option<f64>,
    #[serde(default)]
    pub question_count: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub published: Option<bool>,
}

/// Canvas quiz submission (user's attempt). Fetched from `/api/v1/courses/:id/quizzes/:quiz_id/submissions`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QuizSubmission {
    pub id: u64,
    #[serde(default)]
    pub quiz_id: Option<u64>,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub submitted_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub score: Option<f64>,
    #[serde(default)]
    pub workflow_state: String,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas module. Fetched from `/api/v1/courses/:id/modules`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Module {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub position: Option<u64>,
    #[serde(default)]
    pub workflow_state: String,
    #[serde(default)]
    pub items_count: Option<u64>,
    #[serde(default)]
    pub items_url: Option<String>,
}

/// Canvas module item. Fetched from `/api/v1/courses/:id/modules/:module_id/items`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModuleItem {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub item_type: String,
    #[serde(default)]
    pub content_id: Option<u64>,
    #[serde(default)]
    pub position: Option<u64>,
    #[serde(default)]
    pub completion_requirement: Option<serde_json::Value>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas wiki page. Fetched from `/api/v1/courses/:id/pages`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WikiPage {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub published: Option<bool>,
}

/// Canvas conversation (inbox message). Fetched from `/api/v1/conversations`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Conversation {
    pub id: u64,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub last_message: Option<String>,
    #[serde(default)]
    pub last_message_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub message_count: Option<u64>,
    #[serde(default)]
    pub unread_count: Option<u64>,
    #[serde(default)]
    pub participants: Vec<serde_json::Value>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas planner item. Fetched from `/api/v1/planner/items`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlannerItem {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub context_type: Option<String>,
    #[serde(default)]
    pub context_id: Option<u64>,
    #[serde(default)]
    pub context_name: Option<String>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub completed: Option<bool>,
}

/// Canvas planner note (user personal note). Fetched from `/api/v1/planner_notes`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlannerNote {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub todo_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
}

/// Canvas to-do item (user's task list). Fetched from `/api/v1/users/self/todo`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TodoItem {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub item_type: String,
    #[serde(default)]
    pub course_id: Option<u64>,
    #[serde(default)]
    pub assignment_id: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas group. Fetched from `/api/v1/groups`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Group {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub members_count: Option<u64>,
    #[serde(default)]
    pub context_type: Option<String>,
    #[serde(default)]
    pub context_id: Option<u64>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas group membership. Fetched from `/api/v1/groups/:id/memberships`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupMembership {
    pub id: u64,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub group_id: Option<u64>,
    #[serde(default)]
    pub workflow_state: String,
    #[serde(default)]
    pub moderator: Option<bool>,
}

/// Canvas file metadata. Fetched from `/api/v1/courses/:id/files`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct File {
    pub id: u64,
    #[serde(default)]
    pub filename: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
}

/// Canvas rubric (grading criteria). Fetched from `/api/v1/courses/:id/rubrics`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rubric {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub data: Vec<serde_json::Value>,
    #[serde(default)]
    pub points_possible: Option<f64>,
    #[serde(default)]
    pub html_url: Option<String>,
}

/// Canvas rubric assessment (grade via rubric). Fetched from `/api/v1/courses/:id/rubric_assessments`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RubricAssessment {
    pub id: u64,
    #[serde(default)]
    pub rubric_id: Option<u64>,
    #[serde(default)]
    pub artifact_id: Option<u64>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub assessor_id: Option<u64>,
    #[serde(default)]
    pub assessment_type: Option<String>,
    #[serde(default)]
    pub score: Option<f64>,
    #[serde(default)]
    pub data: Vec<serde_json::Value>,
}

/// Canvas learning outcome. Fetched from `/api/v1/courses/:id/outcomes`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Outcome {
    pub id: u64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub context_id: Option<u64>,
    #[serde(default)]
    pub context_type: Option<String>,
}

/// Canvas outcome result (mastery data). Fetched from `/api/v1/courses/:id/outcome_results`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutcomeResult {
    pub id: u64,
    #[serde(default)]
    pub outcome_id: Option<u64>,
    #[serde(default)]
    pub user_id: Option<u64>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<u64>,
    #[serde(default)]
    pub score: Option<f64>,
    #[serde(default)]
    pub assessed_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    #[test]
    fn parses_course_json() {
        let j = r#"{"id":42,"name":"Math","workflow_state":"available","enrollment_term_id":7}"#;
        let c: Course = serde_json::from_str(j).unwrap();
        assert_eq!(c.id, 42);
        assert_eq!(c.workflow_state, "available");
    }

    #[test]
    fn parses_assignment_missing_optional() {
        let j = r#"{"id":1,"name":"HW"}"#;
        let a: Assignment = serde_json::from_str(j).unwrap();
        assert!(a.due_at.is_none());
        assert!(a.points_possible.is_none());
        assert!(
            a.course_id.is_none(),
            "course_id must be optional — Canvas omits it on /courses/:id/assignments"
        );
    }

    #[test]
    fn parses_assignment_with_explicit_course_id() {
        let j = r#"{"id":1,"name":"HW","course_id":42}"#;
        let a: Assignment = serde_json::from_str(j).unwrap();
        assert_eq!(a.course_id, Some(42));
    }

    #[test]
    fn parses_submission() {
        let j = r#"{"id":9,"assignment_id":1,"workflow_state":"graded","score":95.0,"submitted_at":"2026-01-01T00:00:00Z"}"#;
        let s: Submission = serde_json::from_str(j).unwrap();
        assert_eq!(s.score, Some(95.0));
        assert!(s.submitted_at.is_some());
    }

    #[test]
    fn parses_announcement_json() {
        let j = r#"{"id":5,"title":"Welcome","message":"<p>Hi</p>","posted_at":"2026-04-01T12:00:00Z"}"#;
        let a: Announcement = serde_json::from_str(j).unwrap();
        assert_eq!(a.id, 5);
        assert_eq!(a.title, "Welcome");
        assert!(a.posted_at.is_some());
    }

    #[test]
    fn parses_announcement_minimal() {
        let j = r#"{"id":6}"#;
        let a: Announcement = serde_json::from_str(j).unwrap();
        assert!(a.title.is_empty());
        assert!(a.posted_at.is_none());
    }
}
