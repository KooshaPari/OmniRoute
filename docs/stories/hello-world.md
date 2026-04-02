# Hello World

<StoryHeader
    title="First Operation"
    duration="2"
    difficulty="beginner"
/>

## Objective

Run your first sharecli operation.

## Implementation

```rust
use sharecli::Client;

#[tokio::main]
async fn main() {
    let client = Client::new().await.unwrap();
    let result = client.hello().await.unwrap();
    println!("{}", result);
}
```

## Output

```
Hello from sharecli!
```
