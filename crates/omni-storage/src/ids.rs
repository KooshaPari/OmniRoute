//! Typed entity IDs. Newtype wrappers around `Uuid` give us type-safe method
//! signatures (e.g. `get(ApiKeyId)` vs `get(TenantId)`).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! id_type {
    ($name:ident, $prefix:literal) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            #[must_use]
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }

            #[must_use]
            pub fn from_bytes(b: [u8; 16]) -> Self {
                Self(Uuid::from_bytes(b))
            }

            #[must_use]
            pub const fn as_uuid(&self) -> &Uuid {
                &self.0
            }

            /// Short string id (8 hex chars) suitable for log lines.
            #[must_use]
            pub fn short(&self) -> String {
                self.0.simple().to_string()[..8].to_string()
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}{}", $prefix, self.0.simple())
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                let s = s.strip_prefix($prefix).unwrap_or(s);
                Ok(Self(Uuid::parse_str(s)?))
            }
        }

        impl From<Uuid> for $name {
            fn from(u: Uuid) -> Self {
                Self(u)
            }
        }
    };
}

id_type!(WorkspaceId, "ws_");
id_type!(ApiKeyId, "ak_");
id_type!(ProviderRecordId, "pr_");
id_type!(ModelId, "md_");
id_type!(CallLogId, "cl_");
id_type!(ComboId, "cb_");
id_type!(TenantId, "tn_");
id_type!(UserId, "us_");
id_type!(SessionId, "ss_");
id_type!(ComboForecastId, "cf_");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_serde() {
        let id = ApiKeyId::new();
        let s = serde_json::to_string(&id).unwrap();
        let back: ApiKeyId = serde_json::from_str(&s).unwrap();
        assert_eq!(id, back);
    }

    #[test]
    fn display_with_prefix() {
        let id = TenantId::new();
        let s = id.to_string();
        assert!(s.starts_with("tn_"));
    }

    #[test]
    fn from_str_strips_prefix() {
        let id = TenantId::new();
        let s = id.to_string();
        let parsed: TenantId = s.parse().unwrap();
        assert_eq!(id, parsed);
    }
}
