# Sam's Club automation research

**Date:** 2026-07-19 (updated from live recorder session `session-212657` — full checkout)  
**Drop URL:** `https://www.samsclub.com/ip/Rattle/20186272756` (item ID `20186272756`)  
**Method:** Logged-in recorder export (public DOM blocked by PerimeterX).

---

## Executive summary

Sam's Club runs on **Walmart Glass** (`tenant: SAMS_GLASS`). Automation uses the user's logged-in Chrome tab via manual **Start** on the Sam's Club side panel. Minimum v1 bar: **DOM ATC + hard refresh + navigate to checkout review**. Full place-order when `samsclub_auto_checkout_mode: all`.

**Public DOM scrape:** Blocked by PerimeterX `/are-you-human`. All selectors/APIs below come from logged-in recorder export.

---

## 1. DOM selectors (confirmed — session 2026-07-19)

| Purpose | Selector | Notes |
|--------|----------|-------|
| **Main PDP ATC** | `button[data-automation-id="atc"]` | Text `Add to Cart`; aria `Add to Cart - {title}` |
| Carousel ATC (ignore) | same `data-automation-id="atc"` | aria `Add - {title}` — not the main buy box |
| Cart header count | `#cart-button-header` | aria `Cart contains N item…` |
| Cart checkout | `button[data-automation-id="checkout"]` | Label `Check Out` |
| Place order | `[data-automation-id="place-order-button"]` | Also `data-testid="place-order-button"` |
| Review-order CVV | `#cvv-field`, `input[name="cvv"]` | `type="password"`; 3–4 digits (Amex CID); required every checkout |
| Post-ATC page | `/pac?id={usItemId}&oId={offerId}&…` | Confirmation + recommendations |

**Item ID from URL:** `/ip/{slug}/{itemId}` → path segment is `usItemId` for cart API.

---

## 2. API endpoints (confirmed)

| Endpoint | When | Notes |
|----------|------|-------|
| `GET /orchestra/pdp/graphql/ItemById/…/ip/{id}` | PDP load | Product data (ATF) |
| `GET /orchestra/pdp/graphql/ItemByIdBtf/…/ip/{id}` | PDP load | `availabilityStatus: IN_STOCK` |
| `POST /orchestra/cartxo/graphql/updateItems/{hash}` | ATC | Body: `cartId`, `items[{offerId, usItemId, quantity}]` |
| `POST /orchestra/home/graphql/PlaceOrder/{hash}` | Place order click | Submits order after `generateECToken` |
| `POST /paymentservices/v2/payment/generateECToken` | Pre place-order | Payment token when card on file |

**Not used:** `/api/node/cartservice/v1/carts`, Target `web_checkouts/v1/cart_items`.

**IDs:**

| Field | Example | Source |
|-------|---------|--------|
| `usItemId` | `18638953319` | URL `/ip/…/18638953319` |
| `offerId` | `6EA7B9AB6C4B302E84F6FB387E5B7507` | `/pac?oId=…`, `__NEXT_DATA__`, PDP GraphQL |
| `cartId` | `ca-2c5b1908-8f62-4e13-a969-5be4fd30c212` | `localStorage.glassCartIdMap`, checkout URL |
| `lineItemId` | `li-{uuid}` | Cart updates / removals |

Backend ATC uses `public/injected/samsclub-cart-probe.js` → GraphQL `updateItems` in page context. Requires `offerId` on the PDP (`readOfferIdFromPage`).

---

## 3. Checkout flow

| Step | URL |
|------|-----|
| Post-ATC | `/pac?id={usItemId}&oId={offerId}&…` |
| Cart | `https://www.samsclub.com/cart` |
| Review order | `https://www.samsclub.com/checkout/review-order?cartId={cartId}` |
| Order placed | `https://www.samsclub.com/thankyou?pcid={pcid}&orderId={orderId}` |

Automation success detection uses `/thankyou` (and legacy `/order-confirmation` if seen).

Automation resolves checkout URL from `glassCartIdMap`; falls back to `/cart` if cart id is missing.

---

## 4. Anti-bot

Akamai + PerimeterX (`PXsLC3j22K`). Unauthenticated scrapes land on `/are-you-human`. Extension uses the user's real session.

---

## 5. Automation strategy

- **Primary:** DOM ATC — `button[data-automation-id="atc"]` with carousel exclusion (aria `Add -` vs `Add to Cart`)
- **Optional:** GraphQL `updateItems` when `samsclub_backend_atc_enabled` and `offerId` is on-page
- **Restock:** Hard refresh at `samsclub_refresh_interval_sec` + disabled main ATC / OOS copy
- **Success signal:** `/pac` navigation or cart header count delta
- **Checkout CVV:** When `samsclub_auto_checkout_mode: all`, set **CVV (required for checkout)** in the side panel (`samsclub_checkout_cvv` in `chrome.storage.local`, visible in the panel by design). On review-order, automation fills `#cvv-field`, waits until CVV is valid and Place order is enabled (≤2s), then clicks Place order. CVV is never logged in automation status, history, or recorder exports.

---

## 6. Go/no-go

| Check | Status |
|-------|--------|
| DOM ATC on `/ip/` PDP | **Confirmed** (bananas session) |
| GraphQL cart mutation | **Confirmed** (`updateItems`) |
| Navigate to checkout review | **Confirmed** |
| Full place-order → thankyou | **Confirmed** (`session-212657`) |
| Drop SKU (`20186272756`) ATC | **Pending** — record on drop PDP |
| OOS signals on drop PDP | **Pending** |

---

## 7. Still to record before drop test

See [SAMSCLUB_RECORDING.md](./SAMSCLUB_RECORDING.md) § Pre-flight checklist.
