# craft

Type-safe code generation from schemas. Generate Rust, TypeScript, Go from a single source.

## Features

- **Schema First**: Define once, generate everywhere
- **Type-safe**: Full type inference
- **Templates**: Customizable templates
- **Watch Mode**: Regenerate on change

## Installation

```bash
npm install -g @craft/cli
```

## Usage

Define schema:
```yaml
# schema.yaml
entities:
  User:
    id: string
    name: string
    email: string
    created_at: timestamp
```

Generate:
```bash
craft generate --schema schema.yaml --output ./generated
```

Generates:
- Rust structs
- TypeScript interfaces
- Go structs
- SQL migrations

## License

MIT
