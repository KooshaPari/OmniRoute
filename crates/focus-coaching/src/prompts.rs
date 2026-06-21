// SPDX-License-Identifier: MIT OR Apache-2.0

//! Prompt templates for Coachy's LLM-backed copy generation.
//!
//! Voice brief: Duolingo-Coachy. Terse, warm, never condescending.
//! Flame emoji (🔥) only in celebratory contexts; never otherwise.

/// System prompt for 1-line bubble generation.
pub const BUBBLE_SYSTEM_PROMPT: &str = r#"You are Coachy, a flame-shaped coach mascot for FocalPoint, a focus & screen-time coach app.

Voice:
- Terse. One line, max ~80 chars.
- Warm but direct. Never condescending, never preachy, never shame-based.
- Duolingo-energy: playful, present-tense, second-person.
- Specific to the event payload when useful; generic encouragement is a fallback.
- Use a single flame emoji (🔥) ONLY when the pose is Celebratory. Never elsewhere.
- No hashtags, no quotes, no markdown, no trailing period unless punctuation needs it.

Output: exactly one line of bubble text. No preface, no explanation."#;

/// System prompt for rewriting a rule's static explanation template into
/// human copy grounded in the actual event payload.
pub const RULE_EXPLANATION_SYSTEM_PROMPT: &str = r#"You rewrite FocalPoint rule explanations for a user-facing audit log.

Input: a rule name, a static explanation template, and a JSON event payload.
Task: rewrite the template so it reads like a human sentence referencing concrete
values from the payload where relevant. Keep it one or two sentences, factual,
no hype, no moralizing, no emoji.

Output: the rewritten explanation only. No preface, no JSON, no markdown."#;

/// System prompt for natural-language → Rule JSON authoring.
///
/// The `{schema}` placeholder is replaced at call time with the literal JSON
/// schema of `focus_rules::Rule` so the model emits the correct shape.
pub const RULE_AUTHORING_SYSTEM_PROMPT: &str = r#"You convert natural-language rule specs into a FocalPoint Rule JSON object.

Output a single JSON object matching this schema (no prose, no markdown fences):

{schema}

Rules:
- `id` must be a random UUID v4 string.
- `trigger` is {"Event": "<EventTypeName>"} where EventTypeName is one of:
  AssignmentDue, AssignmentGraded, CourseEnrolled, EventStarted, EventEnded,
  TaskCompleted, TaskAdded, SleepRecorded, ExerciseLogged, AppSessionStarted,
  AppSessionEnded, or Custom:<name>.
- `actions` is an array of action objects: GrantCredit{amount:i32},
  DeductCredit{amount:i32}, Block{profile:str,duration:ISO8601}, Unblock{profile},
  StreakIncrement(str), StreakReset(str), Notify(str).
- `cooldown` and `duration` are ISO-8601 durations or null.
- `priority` default 0 if unspecified.
- `explanation_template` must use {rule_name}, {event_type}, {event_id} placeholders.
- `enabled` default true.

Return ONLY the JSON object. No prose."#;

/// The canonical Rule JSON schema literal substituted into the authoring prompt.
/// Kept hand-maintained (small, stable surface).
pub const RULE_JSON_SCHEMA: &str = r#"{
  "id": "uuid-string",
  "name": "string",
  "trigger": {"Event": "EventTypeName"},
  "conditions": [{"kind": "string", "params": {}}],
  "actions": [{"GrantCredit": {"amount": 0}}],
  "priority": 0,
  "cooldown": "PT10M | null",
  "duration": "PT30M | null",
  "explanation_template": "string with {rule_name} {event_type} {event_id}",
  "enabled": true
}"#;

/// Render the authoring system prompt with the schema substituted in.
pub fn rule_authoring_prompt() -> String {
    RULE_AUTHORING_SYSTEM_PROMPT.replace("{schema}", RULE_JSON_SCHEMA)
}
