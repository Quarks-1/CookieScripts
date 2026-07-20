# Sam's Club live-drop research recorder

Manual research tool for capturing Sam's Club PDP → ATC → checkout flows during drops. **Not** wired to Discord.

## How to use

1. Enable extension; open **Global** panel → turn on **Show Sam's Club recording**.
2. Log into Sam's Club in Chrome.
3. Open **Sam's Club** side panel tab → **Start recording** *before* browsing.
4. Visit drop PDP and in-stock items; use markers (Product page, Add to cart, Cart page, Pre-checkout).
5. **Stop** and **Export** ZIP when done.

Export path: `~/Downloads/CookieScripts/samsclub-live/{date}/session-{time}.zip`

Unpack locally to `research/samsclub-live/` for analysis (not committed to git).

---

## Pre-flight checklist (before automation test)

Start recording **first**, then run through each item in one session if possible.

### Required for ATC → checkout automation

| # | Action | Why |
|---|--------|-----|
| 1 | **Drop PDP** `…/ip/Rattle/20186272756` — load while OOS (if possible) | OOS DOM / disabled ATC signals for restock loop |
| 2 | **Same or other in-stock `/ip/`** — click main **Add to Cart** (not carousel **Add**) | Confirms `data-automation-id="atc"` + `updateItems` for your SKU |
| 3 | Let **`/pac?…`** page load after ATC | Post-add success URL pattern |
| 4 | Open **cart** → **Check Out** → **review-order** (stop before place order unless test item) | Checkout URL + `cartId` + place-order selectors |

### Strongly recommended

| # | Action | Why |
|---|--------|-----|
| 5 | Note **fulfillment** choice (Shipping / Pickup / Delivery) on PDP before ATC | Some SKUs may require intent selection |
| 6 | **Hard refresh** PDP once while watching stock state | Validates resume / refresh behavior |
| 7 | Export with **no truncated** warning if possible (short sessions, one tab) | Session `210619` dropped 64 events — bananas ATC click was missed |

### Optional (backend ATC / checkout mode `all`)

| # | Action | Why |
|---|--------|-----|
| 8 | Capture **`offerId`** for drop SKU in `network.jsonl` or `__NEXT_DATA__` | Required for GraphQL backend ATC |
| 9 | **`glassCartIdMap`** in localStorage after ATC | Checkout URL resolution |
| 10 | Full **place order** on a cheap test item | Checkout-auto DOM steps |

### Markers to use

- **Product page** — on `/ip/…` PDP  
- **Add to cart** — immediately after main ATC click  
- **Cart page** — on `/cart`  
- **Pre-checkout** — on `/checkout/review-order?…`

---

## Capture session checklist (drop URL)

1. `https://www.samsclub.com/ip/Rattle/20186272756` — mark OOS/stock signals  
2. In-stock item — click main ATC; mark **Add to cart**  
3. Cart → checkout — mark **Pre-checkout** (do not complete purchase unless test item)

See [SAMSCLUB_AUTOMATION.md](./SAMSCLUB_AUTOMATION.md) for selectors and API tables.
