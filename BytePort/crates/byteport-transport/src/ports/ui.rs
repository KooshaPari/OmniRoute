//! UI port abstraction — render views and prompt the user.
//!
//! `UiPort` is a presentational boundary: the core/domain code calls into a
//! `UiPort` adapter to display a [`UiView`] or to surface a [`PromptMessage`]
//! to the user, without depending on a concrete UI technology (TUI, web,
//! native window, headless test double, …).

use std::cell::RefCell;
use std::collections::VecDeque;

use thiserror::Error;

/// A view that a `UiPort` adapter can render.
///
/// Each variant represents a top-level screen. Adapters decide how to
/// materialise the view (TUI panes, HTML pages, native windows, …); the
/// domain layer only signals which view should be shown.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UiView {
    /// Aggregate / overview screen.
    Dashboard,
    /// List of devices known to the system.
    DeviceList,
    /// Results from a test run.
    TestResults,
    /// User-configurable settings screen.
    Settings,
}

/// The kind / severity of a [`PromptMessage`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PromptKind {
    /// Informational message; user acknowledges to continue.
    Info,
    /// Non-fatal warning; user acknowledges to continue.
    Warning,
    /// Fatal / error message; user acknowledges to continue.
    Error,
    /// Yes / no confirmation.
    Confirm,
    /// Pick one option from a list.
    Choice,
    /// Free-form text input.
    Input,
}

/// A message shown to the user, optionally collecting a response.
///
/// `options` is meaningful for [`PromptKind::Choice`] prompts; `default` is
/// meaningful for [`PromptKind::Input`] prompts. Adapters may ignore fields
/// that are not relevant for the active `kind`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptMessage {
    pub kind: PromptKind,
    pub title: String,
    pub body: String,
    /// Options for `PromptKind::Choice` prompts.
    pub options: Vec<String>,
    /// Default text for `PromptKind::Input` prompts.
    pub default: Option<String>,
}

impl PromptMessage {
    /// Construct an `Info` prompt.
    pub fn info(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self::new(PromptKind::Info, title, body)
    }

    /// Construct a `Warning` prompt.
    pub fn warning(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self::new(PromptKind::Warning, title, body)
    }

    /// Construct an `Error` prompt.
    pub fn error(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self::new(PromptKind::Error, title, body)
    }

    /// Construct a `Confirm` (yes / no) prompt.
    pub fn confirm(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self::new(PromptKind::Confirm, title, body)
    }

    /// Construct a `Choice` prompt with the given options.
    pub fn choice(
        title: impl Into<String>,
        body: impl Into<String>,
        options: Vec<String>,
    ) -> Self {
        let mut msg = Self::new(PromptKind::Choice, title, body);
        msg.options = options;
        msg
    }

    /// Construct an `Input` prompt with an optional default value.
    pub fn input(
        title: impl Into<String>,
        body: impl Into<String>,
        default: Option<String>,
    ) -> Self {
        let mut msg = Self::new(PromptKind::Input, title, body);
        msg.default = default;
        msg
    }

    fn new(kind: PromptKind, title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            kind,
            title: title.into(),
            body: body.into(),
            options: Vec::new(),
            default: None,
        }
    }
}

/// The user's response to a [`PromptMessage`].
///
/// Cancellation is **not** represented here — adapters signal it by
/// returning `Err(UiError::UserCancelled)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PromptResponse {
    /// Acknowledge an `Info` / `Warning` / `Error` prompt.
    Acknowledge,
    /// `true` = yes, `false` = no for a `Confirm` prompt.
    Confirmed(bool),
    /// Index of the chosen option in `PromptMessage::options` for a `Choice`
    /// prompt.
    Selected(usize),
    /// Text entered for an `Input` prompt.
    Input(String),
}

/// Errors that may occur when interacting with a [`UiPort`] adapter.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum UiError {
    /// The adapter could not render the requested view. The wrapped string
    /// carries adapter-specific diagnostic detail.
    #[error("UI render failed: {0}")]
    RenderFailed(String),
    /// The user dismissed / cancelled the prompt or current view.
    #[error("user cancelled the operation")]
    UserCancelled,
    /// The adapter was asked to perform an operation that is not valid in
    /// its current state (e.g. prompting before any view was shown).
    #[error("UI is in an invalid state for this operation")]
    InvalidState,
}

/// UI port — render views and prompt the user.
pub trait UiPort {
    /// Render the given view.
    ///
    /// Returns `Err(UiError::RenderFailed)` if the adapter cannot produce
    /// the view, and `Err(UiError::InvalidState)` if the adapter is not in
    /// a state where rendering makes sense. `Err(UiError::UserCancelled)`
    /// is returned when the user dismisses the view.
    fn show(&self, view: &UiView) -> Result<(), UiError>;

    /// Show a [`PromptMessage`] and collect the user's response.
    ///
    /// Returns `Err(UiError::UserCancelled)` if the user dismisses the
    /// prompt and `Err(UiError::InvalidState)` if the prompt cannot be
    /// presented in the adapter's current state.
    fn prompt(&self, msg: &PromptMessage) -> Result<PromptResponse, UiError>;
}

/// Mock UI adapter for testing presentation logic without a real UI.
///
/// The adapter records every call and returns pre-configured responses
/// from a FIFO queue. When the queue is empty, [`MockUiAdapter::prompt`]
/// returns `Err(UiError::UserCancelled)` to model a user who dismisses the
/// dialog, which is the safest default for tests.
///
/// The trait methods take `&self` to match the [`UiPort`] contract, so the
/// mock uses [`RefCell`] interior mutability to record calls and advance
/// one-shot flags without requiring `&mut self`.
#[derive(Debug, Clone, Default)]
pub struct MockUiAdapter {
    pub show_calls: RefCell<Vec<UiView>>,
    pub prompt_calls: RefCell<Vec<PromptMessage>>,
    pub responses: RefCell<VecDeque<PromptResponse>>,
    /// When `true`, the next call to [`UiPort::show`] returns
    /// `Err(UiError::RenderFailed)`. The flag is cleared after one use.
    pub fail_next_render: RefCell<bool>,
    /// When `true`, every call to [`UiPort::show`] returns
    /// `Err(UiError::RenderFailed)`.
    pub fail_all_renders: bool,
    /// When `true`, every call to [`UiPort::prompt`] returns
    /// `Err(UiError::InvalidState)`.
    pub invalid_state_for_prompts: bool,
}

impl MockUiAdapter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Enqueue a single response for the next [`UiPort::prompt`] call.
    pub fn with_response(self, response: PromptResponse) -> Self {
        self.responses.borrow_mut().push_back(response);
        self
    }

    /// Enqueue several responses for sequential [`UiPort::prompt`] calls.
    pub fn with_responses(self, responses: Vec<PromptResponse>) -> Self {
        self.responses.borrow_mut().extend(responses);
        self
    }

    /// Configure the next [`UiPort::show`] call to fail with
    /// [`UiError::RenderFailed`].
    pub fn with_render_failure(self) -> Self {
        *self.fail_next_render.borrow_mut() = true;
        self
    }

    /// Configure [`UiPort::show`] to always fail with
    /// [`UiError::RenderFailed`].
    pub fn with_all_render_failures(mut self) -> Self {
        self.fail_all_renders = true;
        self
    }

    /// Configure [`UiPort::prompt`] to always return
    /// [`UiError::InvalidState`].
    pub fn with_invalid_state_for_prompts(mut self) -> Self {
        self.invalid_state_for_prompts = true;
        self
    }
}

impl UiPort for MockUiAdapter {
    fn show(&self, view: &UiView) -> Result<(), UiError> {
        self.show_calls.borrow_mut().push(view.clone());

        // `RefCell::replace` reads the old value and stores the new one in a
        // single call, avoiding a double borrow.
        let one_shot = self.fail_next_render.replace(false);
        if one_shot || self.fail_all_renders {
            return Err(UiError::RenderFailed("mock render failure".into()));
        }
        Ok(())
    }

    fn prompt(&self, msg: &PromptMessage) -> Result<PromptResponse, UiError> {
        self.prompt_calls.borrow_mut().push(msg.clone());

        if self.invalid_state_for_prompts {
            return Err(UiError::InvalidState);
        }
        self.responses
            .borrow_mut()
            .pop_front()
            .ok_or(UiError::UserCancelled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_show_records_view() {
        let ui = MockUiAdapter::new();
        ui.show(&UiView::Dashboard).unwrap();
        ui.show(&UiView::DeviceList).unwrap();
        assert_eq!(
            *ui.show_calls.borrow(),
            vec![UiView::Dashboard, UiView::DeviceList]
        );
    }

    #[test]
    fn mock_prompt_returns_queued_response() {
        let ui = MockUiAdapter::new().with_response(PromptResponse::Confirmed(true));
        let msg = PromptMessage::confirm("Delete?", "Are you sure?");
        let resp = ui.prompt(&msg).unwrap();
        assert_eq!(resp, PromptResponse::Confirmed(true));
        assert_eq!(*ui.prompt_calls.borrow(), vec![msg]);
    }

    #[test]
    fn mock_prompt_drains_responses_in_order() {
        let ui = MockUiAdapter::new().with_responses(vec![
            PromptResponse::Selected(2),
            PromptResponse::Input("hello".into()),
        ]);
        let choice = PromptMessage::choice(
            "Pick",
            "Pick one",
            vec!["a".into(), "b".into(), "c".into()],
        );
        let input = PromptMessage::input("Name", "Enter name", None);

        assert_eq!(ui.prompt(&choice).unwrap(), PromptResponse::Selected(2));
        assert_eq!(
            ui.prompt(&input).unwrap(),
            PromptResponse::Input("hello".into())
        );
        assert_eq!(*ui.prompt_calls.borrow(), vec![choice, input]);
    }

    #[test]
    fn mock_prompt_without_responses_returns_user_cancelled() {
        let ui = MockUiAdapter::new();
        let msg = PromptMessage::info("Hi", "There");
        assert_eq!(ui.prompt(&msg), Err(UiError::UserCancelled));
    }

    #[test]
    fn mock_show_render_failure_is_one_shot() {
        let ui = MockUiAdapter::new().with_render_failure();
        assert_eq!(
            ui.show(&UiView::Settings),
            Err(UiError::RenderFailed("mock render failure".into()))
        );
        // The flag is cleared, so the next call succeeds.
        ui.show(&UiView::Settings).unwrap();
        assert_eq!(
            *ui.show_calls.borrow(),
            vec![UiView::Settings, UiView::Settings]
        );
    }

    #[test]
    fn mock_show_all_render_failures_persist() {
        let ui = MockUiAdapter::new().with_all_render_failures();
        assert!(ui.show(&UiView::Dashboard).is_err());
        assert!(ui.show(&UiView::Dashboard).is_err());
        assert_eq!(
            *ui.show_calls.borrow(),
            vec![UiView::Dashboard, UiView::Dashboard]
        );
    }

    #[test]
    fn mock_prompt_invalid_state_overrides_responses() {
        let ui = MockUiAdapter::new()
            .with_response(PromptResponse::Acknowledge)
            .with_invalid_state_for_prompts();
        let msg = PromptMessage::info("Hi", "There");
        assert_eq!(ui.prompt(&msg), Err(UiError::InvalidState));
        // The response is still in the queue because it was never consumed.
        assert_eq!(ui.responses.borrow().len(), 1);
    }

    #[test]
    fn prompt_message_constructors_set_kind() {
        assert_eq!(
            PromptMessage::info("t", "b").kind,
            PromptKind::Info
        );
        assert_eq!(
            PromptMessage::warning("t", "b").kind,
            PromptKind::Warning
        );
        assert_eq!(
            PromptMessage::error("t", "b").kind,
            PromptKind::Error
        );
        assert_eq!(
            PromptMessage::confirm("t", "b").kind,
            PromptKind::Confirm
        );
        let choice = PromptMessage::choice("t", "b", vec!["x".into(), "y".into()]);
        assert_eq!(choice.kind, PromptKind::Choice);
        assert_eq!(choice.options, vec!["x".to_string(), "y".to_string()]);
        let input = PromptMessage::input("t", "b", Some("def".into()));
        assert_eq!(input.kind, PromptKind::Input);
        assert_eq!(input.default.as_deref(), Some("def"));
    }

    #[test]
    fn ui_error_display_is_informative() {
        assert_eq!(
            UiError::RenderFailed("boom".into()).to_string(),
            "UI render failed: boom"
        );
        assert_eq!(
            UiError::UserCancelled.to_string(),
            "user cancelled the operation"
        );
        assert_eq!(
            UiError::InvalidState.to_string(),
            "UI is in an invalid state for this operation"
        );
    }
}
