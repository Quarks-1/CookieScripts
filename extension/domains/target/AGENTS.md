# Target domain

Target.com product-page automation: add-to-cart, optional auto-checkout, hard refresh / restock wait.

**Persisted keys and messages use `retailer_*` / `RETAILER_*`** — folder name is `target`.

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry.ts`, `content/entry-early.ts` |
| Session (split) | `content/session/index.ts` + siblings |
| Playback | `content/automation/playback.ts`, `checkout-auto.ts` |
| Pure logic | `lib/*` — import barrel `@ext/domains/target/lib/index.ts` from core |
| Background | `background/handlers.ts`, `runtime-state.ts`, `tab-ready.ts` |
| Types | `types/retailer.ts` (re-exported via `@ext/core/types/index.ts`) |
| Live research | `docs/TARGET_AUTOMATION.md`, `scripts/target-*.mjs` |

## Selectors

- PDP ATC: `lib/selectors.ts`
- Checkout: `lib/checkout/selectors.ts`

Update selectors with reference to `docs/TARGET_AUTOMATION.md`.

## Tests

`tests/target/*`

## UI

ATC toggles, auto mode, quantity, auto checkout: `ui/popup/domains/target/`
