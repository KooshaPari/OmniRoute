# Upstream Sync Strategy

## Fork: KooshaPari/colab ← blackboardsh/colab

### Sync Process

1. Fetch upstream changes
2. Merge into main
3. Apply phenotype extensions
4. Test
5. Push to origin

### Extension Points

Custom code that should be preserved during sync:
- `src/specs/` - AgilePlus specs
- `src/webflow-plugin/` - Custom webflow storage
- `src/workflows/` - Phenotype CI workflows
