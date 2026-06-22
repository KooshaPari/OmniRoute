//! pheno-otel/src/metrics.rs — OTLP metrics facade (L25)
//! Per v22 T1, see findings/2026-06-22-v22-T1-L25-metrics-facade.md
use opentelemetry::metrics::{Counter, Histogram, UpDownCounter};
use opentelemetry_sdk::metrics::SdkMeterProvider;

pub struct MetricsHandle {
    pub requests_total: Counter<u64>,
    pub request_errors: Counter<u64>,
    pub request_duration: Histogram<f64>,
    pub inflight: UpDownCounter<i64>,
}

impl MetricsHandle {
    pub fn new(service: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .with_endpoint("http://localhost:4318/v1/traces")
            .build()?;
        let provider = SdkMeterProvider::builder()
            .with_reader(opentelemetry_sdk::metrics::PeriodicReader::builder()
                .with_interval(std::time::Duration::from_secs(60))
                .with_exporter(exporter)
                .build())
            .with_resource(opentelemetry_sdk::Resource::new(vec![
                opentelemetry::KeyValue::new("service.name", service.to_string()),
                opentelemetry::KeyValue::new("service.version", env!("CARGO_PKG_VERSION").to_string()),
            ]))
            .build();
        let meter = provider.meter("phenotype");

        Ok(Self {
            requests_total: meter.u64_counter("requests.total").build()?,
            request_errors: meter.u64_counter("requests.errors").build()?,
            request_duration: meter.f64_histogram("requests.duration").build()?,
            inflight: meter.i64_up_down_counter("requests.inflight").build()?,
        })
    }
}
