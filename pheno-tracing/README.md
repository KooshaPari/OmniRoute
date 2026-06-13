# pheno-tracing

Canonical tracing initialization for the Phenotype monorepo.

This crate consolidates the tracing setup patterns previously duplicated
across `focus-observability` and other consumers into a single one-liner
that any binary can call during startup:

```rust,no_run
fn main() {
    pheno_tracing::init();
    tracing::info!("hello from the Phenotype monorepo");
}
```

Three entry points are provided:

- `init`: pretty console output, `EnvFilter` from `RUST_LOG` (default `info`).
- `init_json`: structured JSON output (production log aggregation).
- `init_with_file`: daily-rotated file appender under the given directory.

All three are process-level idempotent: they call `try_init`, so if a global
subscriber has already been installed (for example, by an embedding host or
a test harness), the call is a silent no-op.

## Environment variables

- `RUST_LOG` — standard `tracing-subscriber::EnvFilter` directive. For
  example: `RUST_LOG=info,pheno_tracing=debug,connector_canvas=trace`.
  When unset, the filter resolves to `info`.

## Span conventions (recommended)

The canonical span names and attribute keys used across the Phenotype
monorepo are documented in `focus-observability`'s top-level module docs.
In short:

- `connector.sync` — connector sync orchestration
- `rule.evaluate` — rules-engine evaluation
- `audit.append` — audit-log append
- `wallet.mutate` — reward / penalty mutations

## Examples

Plain binary:

```rust,no_run
fn main() {
    pheno_tracing::init();
    tracing::info!(service = "phenotype", "boot complete");
}
```

Library, programmatic subscriber (for unit tests):

```rust,no_run
use std::io::Write as _;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
pub struct VecWriter(Arc<Mutex<Vec<u8>>>);

impl VecWriter {
    pub fn new() -> Self { Self::default() }
    pub fn into_string(self) -> String {
        String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for VecWriter {
    type Writer = VecWriterGuard<'a>;
    fn make_writer(&'a self) -> Self::Writer {
        VecWriterGuard(self.0.lock().unwrap())
    }
}

pub struct VecWriterGuard<'a>(std::sync::MutexGuard<'a, Vec<u8>>);

impl<'a> Write for VecWriterGuard<'a> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> { self.0.write(buf) }
    fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
}
```

The `tests/init_test.rs` file in this crate demonstrates the
`tracing::subscriber::with_default` pattern for scoped captures.
