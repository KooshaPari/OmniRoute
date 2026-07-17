# Governance - Portalis

## Quality Gates

### Pre-Commit Checks
- [ ] All tests pass
- [ ] FR traceability verified (ptrace analyze)
- [ ] Code coverage >= 80%
- [ ] Linting passes

### Pre-Merge Checks
- [ ] PR reviewed by 1+ maintainer
- [ ] CI/CD pipeline passes
- [ ] Drift check < 90%
- [ ] Documentation updated

## Branch Strategy

- 
  - Production-ready code
- 
  - Integration branch
- 
  - Feature work

## Release Process

1. Update version in [config file]
2. Update CHANGELOG.md
3. Tag release: git tag -a vX.Y.Z
4. Push: git push --tags

## Compliance

This repository follows:
- Phenotype organization standards
- FR traceability requirements
- AI attribution guidelines (.phenotype/ai-traceability.yaml)

See [AGENTS.md](./AGENTS.md) for agent rules.

Last Updated: 2026-04-04
