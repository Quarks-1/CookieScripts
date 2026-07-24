# Catalog Liveness

Weekly Target/Walmart liveness checks against shipped `extension/core/data/catalog.json`, with optional cleanup PRs for dead/invalid listings.

## Signals

### Target

Fetches `https://www.target.com/p/-/A-<tcin>` and classifies server-rendered HTML:

| Status | Signal |
|---|---|
| `dead` | "Currently unavailable" and no `og:title` |
| `live` | `og:title` present, not unavailable, not marketplace |
| `live_marketplace` | `og:title` + sold-by / Target+ markers |
| `unclear` | Conflicting signals — never auto-pruned |

Network/HTTP errors → `unclear` (never auto-pruned).

**Control abort:** Three known-live TCINs (`95230445`, `95230447`, `94681785`) are checked at start, every 20 listings, and end. If any control reads `dead`, the run is soft-blocked: Walmart is skipped, the report is written with `blocked: true`, and prune refuses to modify the catalog.

### Walmart

`GET https://www.walmart.com/ip/<id>` with `redirect: manual`. Reads `x-usgm-validitemid` and `x-usgm-item-seo-url` (fallback `location`):

| Status | Signal |
|---|---|
| `valid` | Header `"true"` |
| `invalid` | Header `"false"` |
| `unclear` | Missing/other header |

Identity is compared via slug token overlap; `identity_mismatch` when valid but similarity &lt; 0.34 (kept for human review).

## Prune policy

| Report status | Prune? |
|---|---|
| Target `dead` | Yes |
| Target `live_marketplace` | No (yes with `--drop-marketplace`) |
| Target `unclear` | No |
| Walmart `invalid` | Yes |
| Walmart `valid` + `identity_mismatch` | No |
| Report `blocked: true` | Refuse (exit 1) |
| SKU missing from report | No |

## Manual commands

```bash
# Full liveness scan → research/catalog-liveness-report.json
npm run catalog:liveness

# Preview prunable listings (default)
npm run catalog:prune -- --dry-run

# JSON summary for scripting
npm run catalog:prune -- --dry-run --json

# Apply prune to catalog.json
npm run catalog:prune -- --apply

# Also drop Target marketplace listings
npm run catalog:prune -- --apply --drop-marketplace
```

## GitHub Actions

Workflow: **Catalog Liveness** (`.github/workflows/catalog-liveness.yml`)

- Runs Mondays 14:00 UTC and on `workflow_dispatch`
- `check` job uploads `catalog-liveness-report` artifact; fails only on control soft-block
- `cleanup-pr` job opens a PR when prunable listings exist and no open `catalog/liveness-*` PR is present
- Post-apply `npm test` gates PR creation (skipped, not failed, on test failure)
