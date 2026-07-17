# WP06: Distributed Tracing Integration

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 3 - Observability
**Wave**: 2
**Dependencies**: WP03 (Temporal workflows must exist before tracing)
**Author**: Claude Sonnet 4.6

## Mission

Emit OpenTelemetry traces from Temporal workflows to Jaeger. Every workflow execution produces a trace. The full waterfall (workflow → activity → agent runtime → database) is visible in Jaeger. This makes debugging production issues a trace query, not a log scavenger hunt.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-007, SC-004, SC-009
- Plan: `../plan.md` — WP06 section
- Depends on: `WP03-agent-dispatch.md`

## Context

Temporal has built-in OpenTelemetry support. Enable it via the `TemporalSdk` config. The worker SDK emits spans automatically for:
- Workflow execution
- Activity execution
- Child workflow calls
- Signal handling
- Query handling

Additional custom spans can be added for agent runtime calls, database queries, and external API calls.

Jaeger should already be in the planned monitoring stack but may not be deployed yet. If not, deploy Jaeger all-in-one (lightweight, ~500MB RAM) alongside Temporal.

## What to Build

### 1. Deploy Jaeger (if not already deployed)

```yaml
# infra/jaeger/docker-compose.yml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.59
    container_name: jaeger
    command:
      - "--memory.max-traces=10000"
      - "--retention.time=7d"
      - "--span-gateways.enabled=true"
    environment:
      - SPAN_STORAGE_TYPE=badger
      - BADGER_EPHEMERAL=false
      - BADGER_DIRECTORY=/var/lib/jaeger
    ports:
      - "16686:16686"   # UI
      - "4317:4317"     # OTLP gRPC
      - "4318:4318"     # OTLP HTTP
    volumes:
      - jaeger_data:/var/lib/jaeger
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:16686 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  jaeger_data:
```

```caddy
# Caddyfile
jaeger.internal {
  reverse_proxy localhost:16686
  log { output file /var/log/caddy/jaeger.log }
}
```

### 2. Enable OpenTelemetry in Temporal Worker

Update `temporal-worker/src/main.rs`:

```rust
use opentelemetry::{global, trace::Tracer};
use opentelemetry_otlp::WithExportPipeline;
use opentelemetry_sdk::{runtime, trace as sdktrace, Resource};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_tracing() {
    let otlp_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint("http://jaeger:4317");

    let tracer_provider = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(otlp_exporter)
        .with_trace_config(
            sdktrace::Config::default().with_resource(Resource::new(vec![
                opentelemetry::KeyValue::new("service.name", "temporal-worker"),
                opentelemetry::KeyValue::new("deployment.environment", "hetzner"),
            ])),
        )
        .install_batch(runtime::Tokio)
        .expect("Failed to install OTLP tracer");

    let tracer = tracer_provider.tracer("temporal-worker");

    let tracer_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let fmt_layer = tracing_subscriber::fmt::layer().with_target(true);

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(fmt_layer)
        .with(tracer_layer)
        .init();

    global::set_tracer_provider(tracer_provider);
}
```

### 3. Add Jaeger to Process Compose

```yaml
jaeger:
  command: docker compose -f infra/jaeger/docker-compose.yml up -d
```

### 4. Add Custom Spans to Activities

```rust
// In dispatch_to_agent activity:
use opentelemetry::{global, trace::Tracer, Span, SpanKind};
use opentelemetry::trace::FutureExt;

async fn execute(ctx: ActivityContext, input: Input) -> ActivityResult<Output> {
    let tracer = global::tracer("dispatch_to_agent");

    let span = tracer
        .span_builder("dispatch.agent")
        .with_kind(SpanKind::Client)
        .with_attribute("agent.type", input.agent_type.clone())
        .with_attribute("task.id", input.task_id.clone())
        .start();

    let result = execute_internal(&ctx, &input).await.with_context(span.clone());

    span.end();
    result
}
```

## Testing

```bash
# 1. Start Jaeger
docker compose -f infra/jaeger/docker-compose.yml up -d

# 2. Run a complete agent dispatch workflow
tctl workflow run \
  --workflow_type agent_dispatch \
  --task_queue default \
  --input '{"task_id":"trace-test-001","agent_type":"code","prompt":"echo hello","context":{},"timeout_seconds":60}'

# 3. Open Jaeger UI: http://localhost:16686
# 4. Search by: service="temporal-worker", operation="agent_dispatch"
# 5. Verify waterfall: root workflow span → child activity spans → HTTP client spans
```

## Acceptance Criteria

- [ ] Jaeger UI reachable at `https://jaeger.internal`
- [ ] OTLP endpoint reachable at `http://jaeger:4317`
- [ ] Every Temporal workflow execution produces a trace in Jaeger
- [ ] Trace waterfall shows: workflow span → validate activity → dispatch activity → collect activity → notify activity
- [ ] Span attributes include: workflow_id, task_id, step_name, attempt_number
- [ ] Jaeger query by workflow_id returns correct trace
- [ ] Traces survive Temporal restart (traces written to Jaeger independently)
