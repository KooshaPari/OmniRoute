# Hello World Story

<StoryHeader
    title="Your First phenotype-forge Operation"
    :duration="2"
    :gif="'/gifs/phenotype-forge-hello-world.gif'"
    difficulty="beginner"
/>

## Objective

Get phenotype-forge running with a basic operation.

## Prerequisites

- Rust/Node/Python installed
- phenotype-forge package installed

## Implementation

```rust
use phenotype-forge::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize client
    let client = Client::new().await?;
    
    // Execute operation
    let result = client.hello().await?;
    
    println!("Success: {}", result);
    Ok(())
}
```

## Expected Output

```
Success: Hello from phenotype-forge!
```

## Next Steps

- [Core Integration](./core-integration)
- Read [API Reference](../reference/api)
