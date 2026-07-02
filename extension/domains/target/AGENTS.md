# Target domain

Target.com product-page automation: add-to-cart, optional auto-checkout, hard refresh / restock wait.

**Persisted keys and messages use `retailer_*` / `RETAILER_*`** — folder name is `target`.

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry.ts` (`document_end`), `content/entry-early.ts` (`document_start`) |
| Session (split) | `content/session/index.ts` + siblings (see below) |
| Playback | `content/automation/playback.ts`, `checkout-auto.ts` |
| Pure logic | `lib/*` — barrel `@ext/domains/target/lib/index.ts` from core |
| Background | `background/handlers.ts`, `runtime-state.ts`, `tab-ready.ts`, `tab-message.ts` |
| Types | `types/retailer.ts` (re-exported via `@ext/core/types/index.ts`) |
| Research | `docs/TARGET_AUTOMATION.md`, `scripts/target-*.mjs` |

## Session modules (`content/session/`)

| Module | Role |
|---|---|
| `index.ts` | Orchestrator / navigation hooks |
| `auto-mode.ts` | Start/stop auto, cart probe bridge |
| `lifecycle.ts` | Session teardown |
| `messaging.ts` | UI state publish |
| `resume.ts` | Init + checkout resume |
| `session-state.ts` | Shared mutable state |
| `settings-watch.ts` | Storage-driven config sync |
| `purchase-limit.ts` | Limit snapshots + page hooks |
| `checkout-bridge.ts` | Checkout handoff |
| `checkout-abandon.ts` | Checkout abandon |
| `schedule.ts` | Automation run serialization / debounce |

## Selectors

- PDP ATC: `lib/selectors.ts`
- Checkout: `lib/checkout/selectors.ts`

Update with reference to `docs/TARGET_AUTOMATION.md`.

## Messages

Source of truth: [extension/core/types/messages.ts](../../core/types/messages.ts).

- `RetailerToBackground`: `RETAILER_AUTO_STATUS`, `RETAILER_GET_AUTO_CONFIG`, `RETAILER_SET_REFRESH_INTERVAL`, `RETAILER_HARD_RELOAD`, `RETAILER_PING`, `RETAILER_GET_TAB_AUTO_STATE`, `RETAILER_SYNC_MANUAL_STOP`, `RETAILER_SYNC_MANUAL_START`, `RETAILER_UI_STATE`, `RETAILER_PURCHASE_LIMIT_SNAPSHOT`
- `BackgroundToContent`: `RETAILER_START_AUTO`, `RETAILER_STOP_AUTO`, `RETAILER_START_MANUAL_AUTO`, `RETAILER_GET_PURCHASE_LIMIT`, `RETAILER_PING`
- `UiToBackground`: `SET_RETAILER_AUTO_ATC_ENABLED`, `SET_RETAILER_REFRESH_INTERVAL`, `SET_RETAILER_ATC_MODES`, `SET_RETAILER_ATC_QUANTITY`, `SET_RETAILER_AUTO_CHECKOUT_ENABLED`, `RETAILER_START_MANUAL_AUTO`, `RETAILER_STOP_MANUAL_AUTO`
- Content `RETAILER_SET_REFRESH_INTERVAL` and UI `SET_RETAILER_REFRESH_INTERVAL` are distinct messages for the same concern.

## Lib map (by concern)

| Concern | Modules |
|---|---|
| Host / config | `host.ts`, `channel-config.ts` (barrel exports) |
| ATC / cart | `cart-api.ts`, `cart-step.ts`, `cart-retry.ts`, `main-add-to-cart.ts`, `atc-route.ts`, `page-cart-probe-bridge.ts` |
| Playback | `playback-engine.ts`, `pending-start-auto.ts`, `restock-wait.ts`, `waiting-disabled.ts` |
| Refresh / resume | `page-refresh.ts`, `auto-resume.ts` |
| Quantity | `quantity-limit.ts` (barrel export) |
| Checkout | `lib/checkout/*` (`steps.ts`, `place-order.ts`, `checkout-state.ts`, `checkout-url.ts`, `waiting-checkout.ts`) |
| DOM helpers | `dom.ts`, `selectors.ts` |

Core/UI-core import settings helpers via `@ext/domains/target/lib/index.ts` only (see `eslint.config.js`).

## Invariants

- `retailer_*` naming for persisted keys and messages.
- One automation job at a time (`tryAcquireRetailerJob`).
- Backend ATC via `public/injected/cart-probe.js` (runtime path `injected/cart-probe.js`), not content script.
- Hard refresh resume uses Target tab `sessionStorage` (`auto-resume.ts`).
- Avoid re-monolithing `content/session/`.

Global invariants and import rules: [AGENTS.md](../../../AGENTS.md).

## Tests

`tests/target/*`

## UI

ATC toggles, auto mode, quantity, auto checkout: `ui/popup/domains/target/`
