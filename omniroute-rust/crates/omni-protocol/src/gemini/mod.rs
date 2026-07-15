//! Google Gemini wire types.
//!
//! Gemini streams a JSON **array** of `GenerateContentResponse` objects via
//! `streamGenerateContent?alt=sse`, not classic SSE. We model the non-stream
//! response, the per-element stream response, and the request parts/config.

pub mod config;
pub mod generate;
pub mod parts;

pub use config::{GenerationConfig, HarmBlockThreshold, HarmCategory, SafetyRating, SafetySetting};
pub use generate::{GenerateContentRequest, GenerateContentResponse, UsageMetadata};
pub use parts::{Blob, Content, FileData, FunctionCall, FunctionCallingConfig, FunctionDeclaration, FunctionResponse, Part, Role as GeminiRole, Tool, ToolConfig};
