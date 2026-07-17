# Implementation Strategy

- Use one shell block per task to keep the task file easy to reason about.
- Detect by manifest presence instead of hard-coding a language list.
- Keep scaffold surfaces visible in log output, but skip them until they become runnable.
- Use Python snippets for clean-up so the task file does not rely on `rm`.
