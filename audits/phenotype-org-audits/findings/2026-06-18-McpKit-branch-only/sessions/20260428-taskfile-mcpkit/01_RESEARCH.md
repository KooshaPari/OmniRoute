# Research

- `README.md` marks Rust and Python as the real bindings.
- `README.md` also marks Go and TypeScript as scaffold surfaces.
- `rust/Cargo.toml` defines a workspace with `phenotype-mcp-core`, `phenotype-mcp-framework`, and `phenotype-mcp-asset`.
- `typescript/package.json` exists, but there is no `tsconfig.json`, so TypeScript build/test/lint should be skipped for now.
- The Python submodule is uninitialized in this checkout, so root task logic must tolerate that state.
