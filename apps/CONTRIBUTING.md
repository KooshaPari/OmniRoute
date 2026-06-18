# Contributing

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and quality checks
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Commit Message Format

We follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

## Code Review

All submissions require review. Please ensure:
- CI checks pass
- Code is documented
- Tests cover new functionality

## Governance

Project-wide rules live under `docs/governance/`. The canonical
background-agent policy that this repository and sibling repos
(such as `thegent` and `thegent-clean`) point at is:

- [`docs/governance/background_agent_policy.md`](./docs/governance/background_agent_policy.md)

When changing fleet composition, dispatch patterns, or
failure-handling expectations, update that file in the same PR and
reference the governance worklog entry.
