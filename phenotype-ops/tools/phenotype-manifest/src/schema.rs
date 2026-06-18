//! JSON Schema definitions for manifest and pillar configs

use jsonschema::{Draft, JSONSchema};
use serde_json::{json, Value};
use std::sync::OnceLock;

/// Get compiled manifest schema
pub fn manifest_schema() -> &'static JSONSchema {
    static SCHEMA: OnceLock<JSONSchema> = OnceLock::new();
    SCHEMA.get_or_init(|| {
        let schema = manifest_schema_value();
        JSONSchema::options()
            .with_draft(Draft::Draft202012)
            .compile(&schema)
            .expect("Invalid manifest schema")
    })
}

/// Get compiled pillar schema
pub fn pillar_schema() -> &'static JSONSchema {
    static SCHEMA: OnceLock<JSONSchema> = OnceLock::new();
    SCHEMA.get_or_init(|| {
        let schema = pillar_schema_value();
        JSONSchema::options()
            .with_draft(Draft::Draft202012)
            .compile(&schema)
            .expect("Invalid pillar schema")
    })
}

/// Validate a manifest against schema
pub fn validate_manifest(value: &Value) -> Result<(), Vec<String>> {
    let schema = manifest_schema();
    let errors: Vec<String> = schema.iter_errors(value)
        .map(|e| e.to_string())
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Validate a pillar config against schema
pub fn validate_pillar(value: &Value) -> Result<(), Vec<String>> {
    let schema = pillar_schema();
    let errors: Vec<String> = schema.iter_errors(value)
        .map(|e| e.to_string())
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn manifest_schema_value() -> Value {
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://phenotype.dev/schemas/manifest-1.0.json",
        "title": "Phenotype Attestation Manifest",
        "type": "object",
        "additionalProperties": false,
        "required": [
            "schema_version",
            "generated_at",
            "commit_sha",
            "tree_sha",
            "pillars",
            "health_score",
            "expires_at",
            "signature",
            "public_key"
        ],
        "properties": {
            "schema_version": {
                "type": "integer",
                "const": 1,
                "description": "Manifest schema version"
            },
            "generated_at": {
                "type": "string",
                "format": "date-time",
                "description": "ISO 8601 generation timestamp"
            },
            "commit_sha": {
                "type": "string",
                "pattern": "^[a-f0-9]{40}$",
                "description": "Git commit SHA (40 hex chars)"
            },
            "tree_sha": {
                "type": "string",
                "pattern": "^[a-f0-9]{40}$",
                "description": "Git tree SHA (40 hex chars)"
            },
            "pillars": {
                "type": "object",
                "additionalProperties": false,
                "required": ["quality", "security", "perf", "compliance", "docs"],
                "properties": {
                    "quality": { "$ref": "#/$defs/pillarResult" },
                    "security": { "$ref": "#/$defs/pillarResult" },
                    "perf": { "$ref": "#/$defs/pillarResult" },
                    "compliance": { "$ref": "#/$defs/pillarResult" },
                    "docs": { "$ref": "#/$defs/pillarResult" }
                }
            },
            "health_score": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": "Aggregated health score"
            },
            "expires_at": {
                "type": "string",
                "format": "date-time",
                "description": "Manifest expiration timestamp"
            },
            "signature": {
                "type": "string",
                "pattern": "^[A-Za-z0-9+/]+={0,2}$",
                "description": "Base64-encoded Ed25519 signature"
            },
            "public_key": {
                "type": "string",
                "pattern": "^[A-Za-z0-9+/]+={0,2}$",
                "description": "Base64-encoded Ed25519 public key"
            },
            "generator": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "name": { "type": "string" },
                    "version": { "type": "string" },
                    "rustc_version": { "type": "string" },
                    "platform": { "type": "string" }
                },
                "required": ["name", "version", "rustc_version", "platform"]
            }
        },
        "$defs": {
            "pillarResult": {
                "type": "object",
                "additionalProperties": false,
                "required": ["passed", "checks", "duration_ms"],
                "properties": {
                    "passed": { "type": "boolean" },
                    "checks": {
                        "type": "object",
                        "additionalProperties": { "$ref": "#/$defs/checkResult" }
                    },
                    "duration_ms": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "Total duration in milliseconds"
                    },
                    "skip_reason": {
                        "type": ["string", "null"],
                        "description": "Reason if pillar was skipped"
                    }
                }
            },
            "checkResult": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name", "passed", "duration_ms"],
                "properties": {
                    "name": { "type": "string" },
                    "passed": { "type": "boolean" },
                    "duration_ms": { "type": "integer", "minimum": 0 },
                    "output": { "type": ["string", "null"] },
                    "error": { "type": ["string", "null"] },
                    "skipped": { "type": ["boolean", "null"] },
                    "skip_reason": { "type": ["string", "null"] }
                }
            }
        }
    })
}

fn pillar_schema_value() -> Value {
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://phenotype.dev/schemas/pillar-1.0.json",
        "title": "Phenotype Pillar Check Definition",
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "version", "pillar", "checks"],
        "properties": {
            "name": { "type": "string" },
            "version": { "type": "string" },
            "pillar": {
                "type": "string",
                "enum": ["quality", "security", "perf", "compliance", "docs"]
            },
            "checks": {
                "type": "array",
                "items": { "$ref": "#/$defs/check" }
            },
            "skip_if": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "no_changes_to": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Glob patterns - skip if no changed files match"
                    },
                    "not_modified_since_hours": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "Skip if relevant files not modified in N hours"
                    },
                    "env_var": {
                        "type": "string",
                        "description": "Skip if this env var is set to truthy"
                    }
                }
            }
        },
        "$defs": {
            "check": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name", "command", "timeout_seconds"],
                "properties": {
                    "name": { "type": "string" },
                    "command": { "type": "string" },
                    "timeout_seconds": { "type": "integer", "minimum": 1, "maximum": 3600 },
                    "globs": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "File patterns this check is relevant for"
                    },
                    "required_tools": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Tools that must be available"
                    },
                    "allow_failure": {
                        "type": "boolean",
                        "default": false,
                        "description": "Don't fail pillar if this check fails"
                    }
                }
            }
        }
    })
}