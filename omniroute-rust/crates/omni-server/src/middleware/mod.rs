//! Middleware module. Re-exports the auth middleware and provides the
//! router-level wiring (CORS, request-id, tracing).

pub mod auth_layer;
pub use auth_layer::auth_middleware_layer;
pub mod trace;
pub use trace::trace_layer;
pub mod cors;
pub use cors::cors_layer;

pub mod auth_layer {
    use std::sync::Arc;

    use axum::{
        extract::Request,
        middleware::Next,
        response::Response,
    };

    use crate::state::{App, ServerError};

    /// Wrap the auth middleware so it can be plugged into a router with
    /// `from_fn_with_state`.
    pub async fn auth_middleware_layer(
        axum::extract::State(app): axum::extract::State<Arc<App>>,
        req: Request,
        next: Next,
    ) -> Result<Response, ServerError> {
        crate::auth::auth_middleware((*app).clone(), req, next).await
    }
}

pub mod trace {
    use tower_http::trace::TraceLayer;
    pub fn trace_layer() -> TraceLayer<
        tower_http::classify::SharedClassifier<tower_http::classify::ServerErrorsAsFailures>,
    > {
        TraceLayer::new_for_http()
    }
}

pub mod cors {
    use axum::http::{header, HeaderValue, Method};
    use tower_http::cors::CorsLayer;
    pub fn cors_layer() -> CorsLayer {
        CorsLayer::new()
            .allow_origin("*".parse::<HeaderValue>().unwrap())
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                HeaderValue::from_static("x-api-key"),
                HeaderValue::from_static("x-request-id"),
            ])
    }
}
