---
layout: doc
title: Hello World Story
---

# Hello World: Your First Schemaforge Operation

<StoryHeader
    title="First Operation"
    duration="2"
    difficulty="beginner"
    :gif="'/gifs/schemaforge-hello-world.gif'"
/>

## Objective

Execute your first Schemaforge operation successfully.

## Prerequisites

- Rust/Node/Python installed
- Schemaforge CLI installed

## Implementation

```rust
use schemaforge::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new().await?;
    let result = client.hello().await?;
    println!("Success: {}", result);
    Ok(())
}
```

## Expected Output

```
Success: Hello from Schemaforge!
```

## Next Steps

- [Core Integration](./core-integration)
- [API Reference](../reference/api)
