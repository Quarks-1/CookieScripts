# Catalog Liveness

Weekly Target liveness checks against shipped `extension/core/data/catalog.json`, with optional cleanup PRs for dead listings.

Walmart checks are **not run yet** — Walmart listings are never auto-pruned until liveness probing is enabled.

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

**Control abort:** Three known-live TCINs (`95230445`, `95230447`, `94681785`) are checked at start, every 20 listings, and end. If any control reads `dead`, the run is soft-blocked: the report is written with `blocked: true`, and prune refuses to modify the catalog.

### Walmart (deferred)

`check-walmart.mjs` and classify helpers exist but are not invoked by `check.mjs`. Re-enable when ready to probe Walmart headers.

## Prune policy

| Report status | Prune? |
|---|---|
| Target `dead` | Yes |
| Target `live_marketplace` | No (yes with `--drop-marketplace`) |
| Target `unclear` | No |
| Walmart (any) | No — not checked yet |
| Report `blocked: true` | Refuse (exit 1) |
| SKU missing from report | No |

## Manual commands

```bash
# Full Target liveness scan → research/catalog-liveness-report.json
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
- `cleanup-pr` job opens a PR when prunable Target listings exist and no open `catalog/liveness-*` PR is present
- Post-apply `npm test` gates PR creation (skipped, not failed, on test failure)
