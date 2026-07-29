# SKU catalog page

Full-tab Pokémon TCG SKU picker opened via `manifest.json` `options_ui` (`ui/catalog/index.html`, `open_in_tab: true`). Selections merge into global `watch_skus.target` / `watch_skus.walmart` (same lists as the Discord tab SKU pills).

## Entry points

| Entry | Path | Role |
|---|---|---|
| Production | `ui/catalog/index.html` → `main.tsx` → `App.tsx` | Chrome `options_ui`; launched from side panel via `CatalogLaunchButton` |
| Data | `extension/core/data/catalog.json` | Bundled fallback — **import only in `main.tsx`** |
| Live fetch | `extension/core/lib/catalog/fetch-catalog.ts` | Fetches `catalog.json` from `main` on page open; deep-import from `useCatalogData` only (not in catalog barrel) |

Authoring (not shipped): `research/discord/scripts/author-catalog.mjs` reads gitignored `research/discord/catalog-draft.json` + curated hits files.

## Key files

| Area | Path |
|---|---|
| Page shell | `App.tsx`, `components/*`, `hooks/*` |
| Bootstrap | `hooks/useCatalogData.ts` — blocking `resolveCatalog` on mount; empty shell while loading |
| Catalog lib | `extension/core/lib/catalog/{parse,group,selection,index}.ts` — barrel must **not** import JSON |
| Types | `extension/core/types/catalog.ts` (re-exported from `@ext/core/types/index.ts`) |
| Settings helper | `upsertGlobalWatchSkus` in `extension/core/lib/channel-targets.ts` |
| View persistence | `STORAGE_KEYS.catalogView` — `{ groupBy }` only |
| Launch button | `@shared/components/CatalogLaunchButton.tsx` |

## Invariants

- **JSON bundling:** only `ui/catalog/main.tsx` imports `catalog.json` (keeps service worker chunk clean). Bundled copy is offline/first-install fallback only.
- **Live catalog:** on open, `useCatalogData` → `resolveCatalog` fetches `CATALOG_RAW_URL` (`raw.githubusercontent.com`), validates with `parseCatalog`, caches in `chrome.storage.local` under `STORAGE_KEYS.catalogCache` with ETag. Fallback chain: remote → cache → bundled. Cache cleared on extension install/update (`clearCatalogCache` in service worker `onInstalled`).
- **No hint text** — same rule as side panel UI.
- **Marketplace:** shipped catalog has no marketplace listings — `parseCatalog` (`stripMarketplaceListings`) drops them and omits marketplace-only products; `author-catalog.mjs` / `reconcile.mjs` exclude them at authoring. UI still renders marketplace cells when present (tests); retailer checkbox and Select all / None operate on first-party only.
- **Indeterminate:** partial first-party selection; click completes remaining; click when fully selected clears all first-party for that retailer on the row.
- **Caps:** `MAX_SKUS_PER_LIST` (250) per retailer; near-cap select-all is all-or-nothing per product.
- **Clear all:** native `window.confirm` then wipes **both** `watch_skus` lists (including manual SKUs).
- **Cross-surface sync:** `useCatalogSelection` listens to `chrome.storage.onChanged` on `STORAGE_KEYS.settings` (standalone page — no `usePopupStatus` parent).
- **Domain lib barrels:** URL builders from `@ext/domains/target/lib/index.ts` and `@ext/domains/walmart/lib/index.ts` only.

## Pivots and filters

- `groupBy`: `"set"` (type subgroups, `alsoContains` for cross-set) or `"type"` (primary-set subgroups, empty `alsoContains`).
- `retailerFilter`: visibility only — both retailer checkboxes stay on each row.
- `query`, `selectedOnly`: reset each load; `groupBy` persists under `catalogView`.

## Tests

`tests/core/catalog-{data,group,parse,selection,fetch-catalog}.test.ts`, `tests/shared/pill-list-collapse.test.ts`

Global invariants and import rules: [AGENTS.md](../../AGENTS.md).
