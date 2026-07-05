//! Gemini Parts, Content, Tool/Function declarations.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};



#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    #[default]
    User,
    Model,
    /// `function` is the role used when sending a function response back.
    Function,
    System,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Content {
    pub role: Role,
    pub parts: Vec<Part>,
}

/// Tagged union of every Gemini Part type.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Part {
    Text {
        text: String,
    },
    InlineData {
        #[serde(rename = "inlineData")]
        inline_data: Blob,
    },
    FileData {
        #[serde(rename = "fileData")]
        file_data: FileData,
    },
    FunctionCall {
        #[serde(rename = "functionCall")]
        function_call: FunctionCall,
    },
    FunctionResponse {
        #[serde(rename = "functionResponse")]
        function_response: FunctionResponse,
    },
    ExecutableCode {
        #[serde(rename = "executableCode")]
        executable_code: ExecutableCode,
    },
    CodeExecutionResult {
        #[serde(rename = "codeExecutionResult")]
        code_execution_result: CodeExecutionResult,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Blob {
    pub mime_type: String,
    pub data: String, // base64
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileData {
    pub mime_type: String,
    pub file_uri: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionCall {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub args: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionResponse {
    pub name: String,
    pub response: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableCode {
    pub language: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeExecutionResult {
    pub outcome: String,
    pub output: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub function_declarations: Option<Vec<FunctionDeclaration>>,
    /// Google Search grounding.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub google_search: Option<serde_json::Value>,
    /// Code execution tool.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code_execution: Option<serde_json::Value>,
    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionDeclaration {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// OpenAPI 3.0 schema describing the function arguments.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
    /// When true, the model may call this in parallel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameters_json_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub function_calling_config: Option<FunctionCallingConfig>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionCallingConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<FunctionCallingMode>,
    /// List of allowed function names (when mode=ANY with allowedFunctionNames).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_function_names: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub safety_setting: Option<Vec<super::config::SafetySetting>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FunctionCallingMode {
    Unspecified,
    Auto,
    None,
    Any,
}

/// Re-export the safety category type so `parts` is self-contained.
pub use super::config::HarmCategory as _HarmCategoryRef;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn part_text_round_trip() {
        let p = Part::Text { text: "hello".into() };
        let j = serde_json::to_string(&p).unwrap();
        let back: Part = serde_json::from_str(&j).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn part_inline_data() {
        let p = Part::InlineData {
            inline_data: Blob { mime_type: "image/png".into(), data: "BASE64".into() },
        };
        let j = serde_json::to_string(&p).unwrap();
        assert!(j.contains("\"inlineData\""));
        assert!(j.contains("\"mimeType\":\"image/png\""));
    }

    #[test]
    fn content_user_with_text() {
        let c = Content {
            role: Role::User,
            parts: vec![Part::Text { text: "hi".into() }],
        };
        let j = serde_json::to_string(&c).unwrap();
        assert!(j.contains("\"role\":\"user\""));
        assert!(j.contains("\"text\":\"hi\""));
    }
}
