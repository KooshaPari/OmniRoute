# Rich Media Convention — Phenotype Org

> **Canonical location:** `KooshaPari/phenotype-registry` → `RICH_MEDIA.md`
> Copied to each participating repo as a docs-only reference.

## Stub Marker Format

Insert stubs using this **exact** HTML-comment pair so fill-agents can grep them:

```html
<!-- RICH-MEDIA-STUB type="annotated-screenshot|recording-mp4|recording-gif" subject="<what>" journey="<flow>" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *<short human description of what will go here>*
<!-- END-RICH-MEDIA-STUB -->
```

### Attribute reference

| attribute | values | notes |
|-----------|--------|-------|
| `type` | `annotated-screenshot` \| `recording-mp4` \| `recording-gif` | pick the most appropriate |
| `subject` | free text | what the media shows (e.g. `"VRAM plan slider UI"`) |
| `journey` | phenotype-journeys manifest name or `""` | e.g. `"first-plan"`, `"fleet-register"` |
| `status` | `TODO` \| `CAPTURED` \| `PUBLISHED` | fill-agent updates to `CAPTURED`/`PUBLISHED` |

## Grep Targets

```bash
# all stubs
grep -r "RICH-MEDIA-STUB" docs/

# by journey
grep -r 'journey="first-plan"' docs/

# outstanding TODOs
grep -r 'status="TODO"' docs/
```

## Expected Placement Areas (5 categories)

1. **quickstart / getting-started** — `annotated-screenshot` of first-run output or install step
2. **feature walkthroughs** — `recording-gif` per major feature
3. **dashboard / UI pages** — `annotated-screenshot` of each major panel or view
4. **E2E / journey flows** — `recording-mp4` tied to phenotype-journeys journey name
5. **architecture diagrams** — `annotated-screenshot` of component map or data-flow

## Journey Linkage

Where a `docs/journeys/manifests/` directory exists, the `journey=` attribute **MUST** match the manifest slug exactly.

Known hwLedger journeys (13): `first-plan`, `fleet-register`, `traceability-report`, `vram-reconcile`, `inference-run`, `fleet-probe`, `cost-model`, `audit-log`, `fleet-dispatch`, `model-ingest`, `telemetry-sync`, `kv-cache-plan`, `spot-price-scan`.

## Fill-Agent Instructions

1. Search for `status="TODO"` stubs.
2. Capture the screenshot/recording described in `subject=`.
3. Upload asset to `docs/assets/rich-media/<repo>/<slug>.<ext>`.
4. Replace the placeholder callout with a real `<img>` or `<video>` tag.
5. Change `status="TODO"` → `status="PUBLISHED"`.
