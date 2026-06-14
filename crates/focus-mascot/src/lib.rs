//! Coachy — the FocalPoint mascot state machine.
//!
//! Coachy is a fiery flame-shaped coach with a red cape + gold-star buckle. The
//! Rust side owns the *logical* state (pose × emotion × bubble copy). The Swift
//! layer binds this to Spline scenes to render transitions.
//!
//! The character image is fixed; the palette tokens live in
//! `docs/reference/design_tokens.md` under "Mascot asset tokens (Coachy)."
//!
//! LLM-driven bubble text is opt-in via [`MascotMachine::with_coaching`]. When
//! wired, [`MascotMachine::on_event_with_bubble`] asks the provider for a line
//! shaped to the event + pose; on any failure, it falls back to the static
//! `default_bubble_for` copy so offline mode and the kill switch are safe.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use focus_coaching::{complete_guarded, prompts, CoachingProvider};
use serde::{Deserialize, Serialize};
use tracing::warn;

/// Brand name of the mascot. Used in UI copy + accessibility labels.
pub const MASCOT_NAME: &str = "Coachy";

/// Coarse-grained pose category. Each corresponds to one Spline scene.
///
/// Matches the six emotions in the approved Coachy key art:
/// Confident (hero pose) · Encouraging · Curious/Thinking · Stern/Tough-Love ·
/// Celebratory · Sleepy/Disappointed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Pose {
    /// Default hero pose — arms crossed confidently or finger raised ("You can do harder things")
    Confident,
    /// Thumbs up, sparkles, supportive ("You've got this!")
    Encouraging,
    /// Finger on chin, question mark, contemplative
    CuriousThinking,
    /// Arms crossed, eyebrows furrowed ("Focus. No shortcuts.")
    SternToughLove,
    /// Arms up, confetti, celebrating ("Task complete! Let's go!")
    Celebratory,
    /// Slumped, zzz's, low battery ("Rest up. Tomorrow's a win.")
    SleepyDisappointed,
    /// Soft idle state between events
    Idle,
}

/// Fine-grained emotional tint layered over a pose. Drives eye shape, mouth
/// curve, head tilt in the Spline scene.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Emotion {
    Neutral,
    Happy,
    Proud,
    Concerned,
    Stern,
    Excited,
    Tired,
    Warm,
}

/// Event that may trigger a mascot transition. Platform-agnostic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MascotEvent {
    RuleFired { rule_name: String },
    StreakIncremented { name: String, count: u32 },
    StreakReset(String),
    CreditEarned { amount: i64 },
    BypassSpent { remaining: i64 },
    PenaltyEscalated { tier: String },
    AppLaunchedWhileBlocked { bundle_id: String },
    FocusSessionStarted { minutes: u32 },
    FocusSessionCompleted { minutes: u32 },
    DailyCheckIn,
    SleepDebtReported { hours: f32 },
    Idle,
}

/// Full mascot state pushed across FFI to the Swift renderer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MascotState {
    pub pose: Pose,
    pub emotion: Emotion,
    pub since: DateTime<Utc>,
    pub bubble_text: Option<String>,
}

impl MascotState {
    pub fn new(pose: Pose, emotion: Emotion, bubble: Option<String>) -> Self {
        Self { pose, emotion, since: Utc::now(), bubble_text: bubble }
    }

    /// MVP copy bank — deterministic strings per pose. Swap for LLM later.
    pub fn default_bubble_for(pose: Pose) -> &'static str {
        match pose {
            Pose::Confident => "You can do harder things.",
            Pose::Encouraging => "You've got this!",
            Pose::CuriousThinking => "Let's figure it out.",
            Pose::SternToughLove => "Focus. No shortcuts.",
            Pose::Celebratory => "Task complete! Let's go!",
            Pose::SleepyDisappointed => "Rest up. Tomorrow's a win.",
            Pose::Idle => "Finish one task, earn a break.",
        }
    }
}

impl Default for MascotState {
    fn default() -> Self {
        Self::new(Pose::Idle, Emotion::Neutral, Some(Self::default_bubble_for(Pose::Idle).into()))
    }
}

/// Platform-binding trait: the Swift Spline renderer implements this so every
/// Rust-side state transition reaches the animation runtime.
pub trait MascotDriver: Send + Sync {
    fn apply(&self, state: &MascotState);
}

/// Minimal transition table. Designed for extension, not completeness.
pub struct MascotMachine {
    pub state: MascotState,
    coaching: Option<Arc<dyn CoachingProvider>>,
}

impl MascotMachine {
    pub fn new() -> Self {
        Self { state: MascotState::default(), coaching: None }
    }

    /// Attach an LLM-backed bubble text provider. Opt-in — sync `on_event`
    /// still uses static copy even after this is set.
    pub fn with_coaching(mut self, provider: Arc<dyn CoachingProvider>) -> Self {
        self.coaching = Some(provider);
        self
    }

    /// Set/replace the coaching provider in place.
    pub fn set_coaching(&mut self, provider: Option<Arc<dyn CoachingProvider>>) {
        self.coaching = provider;
    }

    /// Async transition that (if a provider is wired) asks the LLM for a
    /// bubble shaped to the event + resulting pose. Falls back to the
    /// deterministic static copy on any failure or when no provider is set.
    pub async fn on_event_with_bubble(&mut self, event: MascotEvent) -> &MascotState {
        let pose_emotion = pose_emotion_for(&event);
        let (pose, emotion) = pose_emotion;
        let fallback = MascotState::default_bubble_for(pose).to_string();
        let bubble = if let Some(provider) = self.coaching.clone() {
            let prompt = format!(
                "Event: {}\nPose: {:?}\nEmotion: {:?}\nWrite Coachy's bubble line.",
                describe_event(&event),
                pose,
                emotion
            );
            match complete_guarded(
                provider.as_ref(),
                &prompt,
                Some(prompts::BUBBLE_SYSTEM_PROMPT),
                60,
            )
            .await
            {
                Ok(Some(text)) => text,
                Ok(None) => fallback.clone(),
                Err(e) => {
                    warn!(target: "coaching.fallback", error = %e, "bubble LLM error");
                    fallback.clone()
                }
            }
        } else {
            fallback.clone()
        };
        self.state = MascotState::new(pose, emotion, Some(bubble));
        &self.state
    }

    /// Apply an event → next state. Pure function of (current state, event).
    pub fn on_event(&mut self, event: MascotEvent) -> &MascotState {
        let (pose, emotion) = pose_emotion_for(&event);
        self.state = MascotState::new(
            pose,
            emotion,
            Some(MascotState::default_bubble_for(pose).to_string()),
        );
        &self.state
    }
}

fn pose_emotion_for(event: &MascotEvent) -> (Pose, Emotion) {
    match event {
        MascotEvent::RuleFired { .. } => (Pose::SternToughLove, Emotion::Stern),
        MascotEvent::StreakIncremented { .. } => (Pose::Encouraging, Emotion::Proud),
        MascotEvent::StreakReset(_) => (Pose::SleepyDisappointed, Emotion::Concerned),
        MascotEvent::CreditEarned { amount } if *amount >= 10 => {
            (Pose::Celebratory, Emotion::Excited)
        }
        MascotEvent::CreditEarned { .. } => (Pose::Encouraging, Emotion::Happy),
        MascotEvent::BypassSpent { remaining } if *remaining <= 0 => {
            (Pose::SternToughLove, Emotion::Stern)
        }
        MascotEvent::BypassSpent { .. } => (Pose::CuriousThinking, Emotion::Concerned),
        MascotEvent::PenaltyEscalated { .. } => (Pose::SternToughLove, Emotion::Concerned),
        MascotEvent::AppLaunchedWhileBlocked { .. } => (Pose::SternToughLove, Emotion::Stern),
        MascotEvent::FocusSessionStarted { .. } => (Pose::Confident, Emotion::Neutral),
        MascotEvent::FocusSessionCompleted { minutes } if *minutes >= 25 => {
            (Pose::Celebratory, Emotion::Excited)
        }
        MascotEvent::FocusSessionCompleted { .. } => (Pose::Encouraging, Emotion::Happy),
        MascotEvent::DailyCheckIn => (Pose::Confident, Emotion::Warm),
        MascotEvent::SleepDebtReported { hours } if *hours < 5.0 => {
            (Pose::SleepyDisappointed, Emotion::Tired)
        }
        MascotEvent::SleepDebtReported { .. } => (Pose::CuriousThinking, Emotion::Concerned),
        MascotEvent::Idle => (Pose::Idle, Emotion::Neutral),
    }
}

fn describe_event(event: &MascotEvent) -> String {
    match event {
        MascotEvent::RuleFired { rule_name } => format!("RuleFired rule={rule_name}"),
        MascotEvent::StreakIncremented { name, count } => {
            format!("StreakIncremented name={name} count={count}")
        }
        MascotEvent::StreakReset(n) => format!("StreakReset name={n}"),
        MascotEvent::CreditEarned { amount } => format!("CreditEarned amount={amount}"),
        MascotEvent::BypassSpent { remaining } => format!("BypassSpent remaining={remaining}"),
        MascotEvent::PenaltyEscalated { tier } => format!("PenaltyEscalated tier={tier}"),
        MascotEvent::AppLaunchedWhileBlocked { bundle_id } => {
            format!("AppLaunchedWhileBlocked bundle={bundle_id}")
        }
        MascotEvent::FocusSessionStarted { minutes } => {
            format!("FocusSessionStarted minutes={minutes}")
        }
        MascotEvent::FocusSessionCompleted { minutes } => {
            format!("FocusSessionCompleted minutes={minutes}")
        }
        MascotEvent::DailyCheckIn => "DailyCheckIn".into(),
        MascotEvent::SleepDebtReported { hours } => format!("SleepDebtReported hours={hours:.1}"),
        MascotEvent::Idle => "Idle".into(),
    }
}

impl Default for MascotMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streak_shows_proud_encouraging() {
        let mut m = MascotMachine::new();
        let s = m.on_event(MascotEvent::StreakIncremented { name: "study".into(), count: 3 });
        assert_eq!(s.pose, Pose::Encouraging);
        assert_eq!(s.emotion, Emotion::Proud);
    }

    #[test]
    fn low_sleep_triggers_sleepy_tired() {
        let mut m = MascotMachine::new();
        let s = m.on_event(MascotEvent::SleepDebtReported { hours: 4.2 });
        assert_eq!(s.pose, Pose::SleepyDisappointed);
        assert_eq!(s.emotion, Emotion::Tired);
    }

    #[test]
    fn big_focus_session_celebrates() {
        let mut m = MascotMachine::new();
        let s = m.on_event(MascotEvent::FocusSessionCompleted { minutes: 50 });
        assert_eq!(s.pose, Pose::Celebratory);
    }

    #[test]
    fn bubble_defaults_are_set() {
        assert!(!MascotState::default_bubble_for(Pose::Confident).is_empty());
        assert!(!MascotState::default_bubble_for(Pose::SleepyDisappointed).is_empty());
    }

    use focus_coaching::{NoopCoachingProvider, StubCoachingProvider};
    use std::sync::Arc;

    #[tokio::test]
    async fn llm_bubble_used_when_provider_wired() {
        let provider: Arc<dyn focus_coaching::CoachingProvider> =
            Arc::new(StubCoachingProvider::single("Nice streak — keep rolling."));
        let mut m = MascotMachine::new().with_coaching(provider);
        let s = m
            .on_event_with_bubble(MascotEvent::StreakIncremented { name: "study".into(), count: 4 })
            .await;
        assert_eq!(s.bubble_text.as_deref(), Some("Nice streak — keep rolling."));
        assert_eq!(s.pose, Pose::Encouraging);
    }

    #[tokio::test]
    async fn llm_bubble_falls_back_to_static_when_noop() {
        let provider: Arc<dyn focus_coaching::CoachingProvider> = Arc::new(NoopCoachingProvider);
        let mut m = MascotMachine::new().with_coaching(provider);
        let s = m.on_event_with_bubble(MascotEvent::Idle).await;
        assert_eq!(s.bubble_text.as_deref(), Some(MascotState::default_bubble_for(Pose::Idle)));
    }

    #[tokio::test]
    async fn llm_bubble_without_provider_uses_static() {
        let mut m = MascotMachine::new();
        let s = m.on_event_with_bubble(MascotEvent::FocusSessionCompleted { minutes: 50 }).await;
        assert_eq!(s.pose, Pose::Celebratory);
        assert_eq!(
            s.bubble_text.as_deref(),
            Some(MascotState::default_bubble_for(Pose::Celebratory))
        );
    }

    // Traces to: FR-MASCOT-002
    #[tokio::test]
    async fn test_fr_mascot_002_coaching_message_generation() {
        let mut machine = MascotMachine::new();
        let state = machine.on_event_with_bubble(MascotEvent::RuleFired { rule_name: "test_rule".into() }).await;
        assert!(!state.bubble_text.as_deref().unwrap_or("").is_empty());
    }
}
