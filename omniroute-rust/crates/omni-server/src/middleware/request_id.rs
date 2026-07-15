//! Request ID middleware. Generates a UUID per request, propagates via
//! `X-Request-Id` header.

use axum::http::{HeaderName, HeaderValue};
use uuid::Uuid;

pub const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

pub fn make_request_id() -> Uuid {
    Uuid::new_v4()
}

pub fn with_request_id(id: Uuid) -> HeaderValue {
    HeaderValue::from_str(&id.to_string()).unwrap_or(HeaderValue::from_static("invalid"))
}
