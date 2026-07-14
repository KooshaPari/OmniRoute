//! Adaptive engine — picks the right engine + ratio per message segment.

use crate::{aggressive, caveman, rtk, Engine};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentKind {
    System,
    User,
    Assistant,
    Tool,
    Function,
}

/// Pick an engine for a given segment kind.
pub fn engine_for(kind: SegmentKind) -> Engine {
    match kind {
        // System messages: preserve semantic content, light compression only
        SegmentKind::System => Engine::Rtk,
        // User messages: terse but coherent
        SegmentKind::User => Engine::Caveman,
        // Assistant messages: keep, lightly compress
        SegmentKind::Assistant => Engine::Rtk,
        // Tool results: aggressive — they're often large JSON
        SegmentKind::Tool => Engine::Aggressive,
        // Function: aggressive
        SegmentKind::Function => Engine::Aggressive,
    }
}

/// Heuristic segment classifier based on JSON shape.
pub fn classify(value: &serde_json::Value) -> SegmentKind {
    let role = value
        .get("role")
        .and_then(|v| v.as_str())
        .unwrap_or("user");
    match role {
        "system" | "developer" => SegmentKind::System,
        "tool" => SegmentKind::Tool,
        "function" => SegmentKind::Function,
        "assistant" => SegmentKind::Assistant,
        _ => SegmentKind::User,
    }
}

/// Compress a single message's content using the engine best suited to it.
pub fn compress_message(message: &serde_json::Value) -> serde_json::Value {
    let kind = classify(message);
    let engine = engine_for(kind);
    let content = match message.get("content") {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(_)) => {
            // Multi-part: compress text parts only, leave images alone
            return message.clone();
        }
        _ => return message.clone(),
    };
    let compressed = match engine {
        Engine::Rtk => rtk::compress(&content),
        Engine::Caveman => caveman::compress(&content),
        Engine::Aggressive => aggressive::compress(&content),
        Engine::Adaptive => unreachable!(),
    };
    let mut out = message.clone();
    if let Some(obj) = out.as_object_mut() {
        obj.insert("content".into(), serde_json::Value::String(compressed));
    }
    out
}
