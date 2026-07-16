# fuzz targets (cargo-fuzz)

## Setup
cargo install cargo-fuzz
cargo fuzz init

## Running
cargo fuzz run chat_parse -- -runs=1000000

## Targets
- chat_parse: malformed chat-completions JSON
- provider_id: adversarial provider_id strings
- routing_key: out-of-bounds routing strategy keys
