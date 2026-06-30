# Target.com Add-to-Cart Automation Research

**Date:** 2026-06-28  
**Method:** Live Puppeteer sessions against `target.com` (headless Chrome 131), network capture, in-page `fetch` probes, cross-check with CookieScripts retailer automation code.  
**Raw captures:** `research/target-live/` (`atc-network.json`, `api-probes.json`, `drop-1011209279.json`, `summary.json`)

---

## Executive summary

Target.com is automatable from an MV3 **content script** on `https://www.target.com/*` using DOM interaction, with optional `fetch()` to guest cart APIs in the **same tab session**. The most reliable primary selector is the TCIN-scoped button id `addToCartButtonOrTextIdFor{tcin}` inside `[data-test="@web/AddToCart/FulfillmentSection"]`. Cart mutation goes through `carts.target.com/web_checkouts/v1/cart_items` (not Redsky). High-demand items and headless/automation fingerprints trigger **Shape Security** headers (`x-gyjwza5z-*`) and Redsky captcha flows. CookieScripts’ existing approach (scoped DOM + keyboard Enter hold + cart confirmation + `/checkout/start` navigation) aligns with observed behavior.

---

## 1. Recommended DOM selectors

### Primary (stable — use these)

| Purpose | Selector | Notes |
|--------|----------|-------|
| Main ATC scope | `[data-test="@web/AddToCart/FulfillmentSection"]` | Always present on hydrated PDPs |
| Shipping sub-scope | `[data-test="@web/AddToCart/Fulfillment/ShippingSection"]` | Present when shipping fulfillment UI is split |
| Sticky ATC bar | `[data-test="StickyAddToCartFulfillmentSection"]` | Mobile/sticky duplicate; can show “N in cart” |
| **Main button (best)** | `#addToCartButtonOrTextIdFor{tcin}` | `{tcin}` from URL `/A-{digits}`; stable across redesigns |
| Fulfillment tabs | `button[data-test="fulfillment-cell-shipping"]` | Select shipping before ATC on multi-fulfillment PDPs |
| | `button[data-test="fulfillment-cell-pickup"]` | Pickup tab |
| | `button[data-test="fulfillment-cell-delivery"]` | Same-day/Shipt delivery tab |
| Ship-it pre-step | `button[data-test="shipItButton"]` | Legacy/alternate shipping CTA (optional click) |
| Cart count (header) | `[data-test="@web/CartLink"]` | `aria-label` like `cart 3 items` |
| Cart qty badge | `[data-test="@web/CartLinkQuantity"]` | Numeric badge when present |
| ATC success modal | `[data-test*="addToCartSuccess"]` | Post-add confirmation UI |
| OOS message | `[data-test="outOfStockMessage"]` | e.g. “Out of stock at Dulles” |

**TCIN parsing:** `pathname.match(/\/A-(\d+)/)` — works on canonical PDP URLs and affiliate unwraps (`goto.target.com`).

### Secondary (use with scope + TCIN guard)

| Selector | When it appears | Risk |
|----------|-----------------|------|
| `button[data-test="shippingButton"]` | Shipping fulfillment primary CTA | Good fallback inside fulfillment scope |
| `button[data-test="orderPickupButton"]` | Pickup-selected PDPs | **Observed on in-stock Scotch tape PDP** — label still “Add to cart” but `data-test` says pickup |
| `button[data-test="addToCartButton"]` | Older/alternate layouts | Medium stability |
| `button[data-test="showInStockPrimaryButton"]` | Store-inventory OOS substitute | Clicks open store finder, **not** ATC |
| `button[data-test="chooseOptionsButton"]` | Recommendation carousel | **Must exclude** — different TCINs |

### Fragile (avoid as primary)

- CSS module classes: `styles_btn__*`, `styles_ndsButtonPrimary__*` — change per build
- Quantity `<select id="select-_r_*">` — React-generated ids (`select-_r_2j_`)
- Generic `button:contains("Add to cart")` without scope — hits recommendation tiles
- `data-test="sign-in-to-buy-now-button"` — different flow (auth-gated buy now)

### Button state semantics (live observations)

| State | DOM signal | Automation behavior |
|-------|------------|---------------------|
| Ready | `#addToCartButtonOrTextIdFor{tcin}` enabled, actionable | Click / Enter-hold |
| OOS / unavailable | `disabled=true` on main id, body “Out of stock”, `outOfStockMessage` | Wait + hard refresh (CookieScripts pattern) |
| Wrong fulfillment | Primary id present but `showInStockPrimaryButton` or pickup-only | Click `fulfillment-cell-shipping` first |
| Recommendations | `chooseOptionsButton` + different TCIN in id | Exclude via ancestor guards (already in `main-add-to-cart.ts`) |

---

## 2. API endpoints

### Guest cart (mutations) — `carts.target.com`

**Base:** `https://carts.target.com/web_checkouts/v1/`  
**Public API key (query param):** `key=9f36aeafbe60771e321a7cc95a78140772ab3e96` (embedded in page JS / Adobe `_satellite` vars)

#### Add item — `POST /cart_items`

```
POST https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART%2CCART_ITEMS%2CSUMMARY&key=9f36aeafbe60771e321a7cc95a78140772ab3e96
```

**Request body (observed on live click + fetch probe):**

```json
{
  "cart_item": {
    "item_channel_id": "10",
    "tcin": "13356914",
    "quantity": 1
  },
  "cart_type": "REGULAR",
  "channel_id": "10",
  "shopping_context": "DIGITAL"
}
```

**Required headers (minimum that succeeded from content-script context):**

| Header | Value |
|--------|-------|
| `accept` | `application/json` |
| `content-type` | `application/json` |
| `x-application-name` | `web` (recommended; matches site) |
| Cookies | Guest session cookies via `credentials: "include"` |

**Shape Security headers (sent by React click handler, often required under bot scrutiny):**

- `x-gyjwza5z-a`, `x-gyjwza5z-b`, `x-gyjwza5z-c`, `x-gyjwza5z-d`, `x-gyjwza5z-f`, `x-gyjwza5z-z`

CORS preflight explicitly lists these. They are generated client-side by Shape/F5 bot-defense JS — **not reproducible from a service worker** without the page’s JS runtime.

**Success response:** `201 Created` with `cart_id`, `cart_item_id`, `tcin`, `quantity`, `fulfillment`, etc.

#### Read cart — `GET /cart`

```
GET https://carts.target.com/web_checkouts/v1/cart?cart_type=REGULAR&field_groups=ADDRESSES%2CCART_ITEMS%2CSUMMARY&key={key}&client_feature=add_to_cart
```

- Empty guest cart often returns **`204 No Content`**
- Populated cart returns **`200`** with `guest_id`, `cart_state: "PENDING"`, `guest_type: "GUEST"`, line items, alerts (e.g. add-on threshold)

#### Checkout pipeline (documented in community scripts, not fully exercised here)

| Step | Endpoint |
|------|----------|
| Pre-checkout | `POST /pre_checkout?field_groups=ADDRESSES,CART,...&key={key}` body `{"cart_type":"REGULAR"}` |
| Checkout | `POST /checkout?field_groups=...&key={key}` body `{"cart_type":"REGULAR","channel_id":10}` |
| Payment validation | `POST https://gsp.target.com/.../credential_validations?client_id=ecom-web-1.0.0` |

Completing checkout requires **signed-in account or guest email/phone** on `/checkout/start`.

### Redsky (read-only product/fulfillment) — `redsky.target.com`

Redsky does **not** add to cart. It powers PDP hydration:

| Endpoint pattern | Purpose |
|------------------|---------|
| `/redsky_aggregations/v1/web/pdp_client_v1` | Core product, price, fulfillment |
| `/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1` | Store/zip fulfillment |
| `/redsky_aggregations/v1/web/pdp_personalized_v1` | Personalization |
| `/redsky_aggregations/v1/web/pdp_circle_offers_v1` | Circle offers |
| `/redsky_aggregations/v1/web/store_location_v1` | Store metadata |

Common query params: `tcin`, `store_id`, `visitor_id`, `channel=WEB`, `page=/p/A-{tcin}`, `is_bot=false`, `key={apiKey}`.

**Bot signals:** Requests to `redsky.target.com/captcha`, `RttCheck`, `AtaVerifyCaptcha` observed on PDP load (especially headless / datacenter IP).

### Other telemetry (ignore for ATC)

- `api.target.com/firefly_events/v1/events/*` — analytics
- `api.target.com/telemetry_data/v1/traces` — OpenTelemetry

---

## 3. Network flow on “Add to cart” click

Observed sequence (Scotch tape TCIN `13356914`, pickup-default PDP):

1. Page load → `GET carts.../cart` (204 empty) + multiple Redsky GETs
2. User click `#addToCartButtonOrTextIdFor13356914`
3. `OPTIONS carts.../cart_items` (CORS preflight with Shape header list)
4. `POST carts.../cart_items` with JSON body + Shape headers + `x-application-name: web`
5. UI may update cart badge / success modal (badge update can lag; don’t rely on badge alone)

**In-page `fetch` probe (same tab, after PDP load):** `POST cart_items` with only `accept`, `content-type`, and `credentials: "include"` returned **`201`** without Shape headers. This suggests Shape is enforced more aggressively for UI-initiated flows and hot items, but a content script `fetch` may work on a warmed guest session — **not guaranteed at scale**.

---

## 4. Quantity selectors

- Quantity control is a **`<select>`** inside fulfillment section, e.g. id `select-_r_2j_`, visible text `Qty1`
- No stable `data-test` on quantity in observed PDPs
- Default quantity `1` is used in API body when not changed
- For automation: defaulting to qty 1 is safest; changing qty requires opening the select (fragile id)

---

## 5. Out-of-stock, loading, and bot detection

| Signal | Example |
|--------|---------|
| OOS | `disabled` main button, “Out of stock” in body, `outOfStockMessage` |
| Store-only OOS | `showInStockPrimaryButton` replaces ATC |
| Page error | “This page is currently unavailable” (stale TCIN / soft block) |
| High traffic | Generic error pages; Redsky captcha iframes |
| Shape | `x-gyjwza5z-*` headers on `cart_items` POST |
| Redsky captcha | `redsky.target.com/captcha?trackingId=...` |
| `is_bot` query param | Present on Redsky URLs (`is_bot=false` sent by real browser) |

Headless Puppeteer without stealth triggered captcha telemetry on Pokémon PDP but still loaded product data. Datacenter IPs are higher risk.

---

## 6. Checkout `/checkout/start`

| Observation | Detail |
|-------------|--------|
| URL | `https://www.target.com/checkout/start` (also `/checkout` after hydration) |
| Success URL | `https://www.target.com/order-confirmation` (pathname prefix) |
| Guest cart | Works without login; `guest_type: "GUEST"` in cart API |
| Checkout UI | Renders “Checkout” (`data-test="checkout-title"`), loading skeleton, auth flyout (`@web/auth-components/AuthSignInFlyout`) |
| Signed-in steps | `save_and_continue_button_step_SHIPPING`, optional gift/payment save buttons, `placeOrderButton` |
| CookieScripts flow | After ATC: `location.assign('/checkout/start')`; with `retailer_auto_checkout_enabled`, spam steps through place order |
| Payment | Apple Pay button present (`apple-pay-checkout-latest`); auto checkout v1 requires saved card on signed-in account |

Signed-in auto checkout (v0.1+) uses DOM step spam + hard refresh on stall. Guest checkout remains out of scope.

---

## 7. MV3 content script: what works vs what doesn’t

### Works (content script on `target.com`)

| Capability | Mechanism |
|------------|-----------|
| Find & click ATC | DOM APIs + synthetic events (CookieScripts uses Enter-hold + `activateElement`) |
| Wait for hydration | Poll `resolveMainAddToCartWaitState` / MutationObserver-style retry |
| Confirm cart | Header `aria-label`, success modal, “N in cart” sticky text |
| Navigate to checkout | `location.assign` |
| Guest cart API | `fetch('https://carts.target.com/...', { credentials: 'include' })` from page context — **same-site cookies** |
| Read TCIN from URL | `/A-{tcin}` regex |

### Does not work / risky

| Limitation | Reason |
|------------|--------|
| Service worker `fetch` to `carts.target.com` without tab cookies | Different context; guest cart is cookie-bound to the tab session |
| Background `fetch` with copied cookies | MV3 restrictions; brittle vs HttpOnly cookies |
| Redsky for cart mutations | Read-only aggregation layer |
| Skipping Shape on hot drops | API returns 403/blocked without `x-gyjwza5z-*` when defenses tighten |
| CORS from non-Target origins | `carts.target.com` allows `origin: https://www.target.com` only |
| Fully unattended checkout | Auth, CVV, 3DS, fraud checks on `gsp.target.com` |
| Cross-origin iframe access | Payment widgets isolated |

**CORS note:** `carts.target.com` is **same-site** relative to `www.target.com` (both `target.com` registrable domain). Content-script `fetch` inherits page origin — **no CORS issue** when called from injected script in the Target tab.

---

## 8. Speed and resilience recommendations

1. **Prefer TCIN id selector** over `data-test` on the button — `data-test` varies (`orderPickupButton`, `shippingButton`, `showInStockPrimaryButton`).
2. **Scope queries** to `@web/AddToCart/FulfillmentSection` and exclude `chooseOptionsButton` / `addToCartSuccess*` ancestors (already implemented).
3. **Optional:** click `fulfillment-cell-shipping` when default fulfillment isn’t shippable.
4. **Wait strategy:** treat `disabled` main button as `waiting_disabled` + hard refresh interval (matches high-drop restock pattern).
5. **Confirm cart** via multiple signals: `readCartCountFromDocument`, `hasCartAddSuccessUi`, not click alone.
6. **Retry ATC** at ~10 ms interval while enabled (existing `cart-retry.ts` pattern) — Target UI can debounce clicks.
7. **API fallback (experimental):** after PDP hydration, content script could `POST cart_items` with `tcin` from URL — faster than DOM if Shape doesn’t block; fall back to DOM on non-201.
8. **Don’t navigate to checkout** until cart confirmed — checkout with empty cart shows auth shell only.
9. **Avoid opening many parallel Target tabs** — increases captcha rate.
10. **User data dir / logged-in session** improves checkout success but raises ToS/account risk.

---

## 9. Comparison to typical e-commerce patterns

| Pattern | Amazon | Walmart | **Target** |
|---------|--------|---------|------------|
| Primary ATC selector | `#add-to-cart-button` | `button[data-automation-id="add-to-cart"]` | `#addToCartButtonOrTextIdFor{tcin}` |
| Scoped container | `#desktop_buybox` | Item page form | `[data-test="@web/AddToCart/FulfillmentSection"]` |
| Cart API | Internal `/cart/add` | CX API | `carts.target.com/web_checkouts/v1/cart_items` |
| Bot protection | Mixed | PerimeterX common | **Shape (`x-gyjwza5z-*`)** + Redsky captcha |
| Guest cart | Yes | Yes | Yes (`guest_type: "GUEST"`) |
| Product API | Partial | Partial | **Redsky (read-only)** |
| Fulfillment complexity | Low–medium | Medium | **High** (pickup / delivery / shipping tabs) |
| Checkout entry | `/checkout` | `/checkout` | `/checkout/start` |

Target is **more fulfillment-state-dependent** than Amazon and **more bot-hardened on cart POST** than average Shopify sites.

---

## 10. Alignment with CookieScripts codebase

Existing implementation already matches this research:

| File | Match |
|------|-------|
| `extension/domains/target/lib/main-add-to-cart.ts` | TCIN id, fulfillment scopes, exclusion zones |
| `extension/domains/target/lib/selectors.ts` | `shippingButton`, `orderPickupButton`, id prefix |
| `extension/domains/target/lib/cart-step.ts` | Cart aria, success modal, sticky “in cart” |
| `extension/domains/target/content/automation/playback.ts` | Enter-hold + retry + cart confirm |
| `extension/domains/target/lib/playback-engine.ts` | Optional `shipItButton`, navigate `/checkout/start` |

**Potential improvements from this research:**

- Add `orderPickupButton` and `showInStockPrimaryButton` handling — treat `showInStockPrimaryButton` as **non-ATC** (store finder)
- Add `fulfillment-cell-shipping` click step before ATC on multi-fulfillment PDPs
- Add `outOfStockMessage` as negative signal in wait state
- Document Shape header risk in README; API fallback as optional fast path

---

## 11. Drop / OOS PDP patterns — TCIN `1011209279` (Pokémon TCG)

**URL:** `https://www.target.com/p/-/A-1011209279` (also `/p/restockr/-/A-…`)  
**Product:** Pokémon Trading Card Game: First Partner Illustration Collection Series 2 — `$17.99`, purchase limit **2**, final sale / no returns  
**Capture:** `research/target-live/drop-1011209279.json` (2026-06-28, post-drop OOS)  
**Reference in-stock PDP:** Scotch tape `A-13356914` (same capture file, side-by-side)

This TCIN is the canonical CookieScripts test fixture (`tests/main-add-to-cart.test.ts`) and represents **high-demand TCG drop** behavior, not a normal consumables PDP.

### 11.1 Current OOS DOM (live)

| Element | Drop OOS (`1011209279`) | In-stock ref (`13356914`) |
|---------|-------------------------|---------------------------|
| Main button id | `#addToCartButtonOrTextIdFor1011209279` | `#addToCartButtonOrTextIdFor13356914` |
| Main `data-test` | **`null`** | `orderPickupButton` |
| Main `disabled` | **`true`** | `false` |
| Main label | “Add to cart” (still visible) | “Add to cart” |
| Fulfillment tabs | **Absent** — section contains only the disabled ATC | `fulfillment-cell-pickup`, `-delivery`, `-shipping` all present |
| Shipping section | `[data-test="@web/AddToCart/Fulfillment/ShippingSection"]` **missing** | N/A (tabs inline) |
| Sticky bar CTA | **“Find alternative”** (enabled, not ATC) | “Qty1” + enabled ATC mirror |
| Qty selector | **None** | `<select>` “Qty 1” |
| `sign-in-to-buy-now` | **Absent** | Present (`data-test="sign-in-to-buy-now-button"`) |
| Body copy | “Out of stock”, “Final sale item”, “Bestseller”, “New at Target” | Pickup/shipping ETA lines, no OOS |
| `[data-test="outOfStockMessage"]` | **Not present** (OOS is plain text near price) | Not present on ref either |
| `[data-test="NonbuyableSection"]` | **Present** | Absent |
| Recommendation tiles | Enabled `chooseOptionsButton` on **other TCINs** below fold | Standard recs |

**Critical trap:** Six+ enabled “Add to cart” buttons exist on the OOS drop page — all are **`chooseOptionsButton`** recommendation tiles (`addToCartButtonOrTextIdFor1009790281`, etc.). CookieScripts’ TCIN guard + exclusion zones correctly ignore these; a naive global `button:contains("Add to cart")` would cart the wrong SKU.

### 11.2 Network on OOS drop page load

| Request | Drop OOS behavior |
|---------|-------------------|
| `GET carts.../cart?client_feature=add_to_cart` | `204` (empty guest cart) |
| Redsky `pdp_client_v1` | Initially `403` → captcha; after verify, `200` with product metadata |
| Redsky `product_fulfillment_and_variation_hierarchy_v1` | `200` — see fulfillment JSON below |
| Redsky `pdp_recommendations_placement_v1?placement_id=adapt_pdp_oos_01` | `200` — **OOS-specific** “Find alternative” carousel |
| Redsky captcha / `RttCheck` / `AtaVerifyCaptcha` | **Heavy** — multiple round-trips on Pokémon PDP |
| `POST carts.../cart_items` (probe) | **`424`** `INVENTORY_UNAVAILABLE` |

**Redsky fulfillment (OOS, zip 20147, store 2272):**

```json
{
  "is_out_of_stock_in_all_store_locations": true,
  "sold_out": false,
  "shipping_options": {
    "availability_status": "OUT_OF_STOCK",
    "available_to_promise_quantity": 0.0,
    "reason_code": "INVENTORY_UNAVAILABLE"
  },
  "order_pickup": { "availability_status": "UNAVAILABLE" }
}
```

**Cart API error body (OOS):**

```json
{
  "code": "DEPENDENT_SERVICE_ERROR",
  "alerts": [{
    "code": "INVENTORY_UNAVAILABLE",
    "message": "inventory is not available for this item",
    "metadata": { "tcin": "1011209279" }
  }]
}
```

Compare in-stock Scotch tape: Redsky `shipping_options.availability_status: "IN_STOCK"`, `available_to_promise_quantity: 21`, cart `POST` → **`201`**.

### 11.3 Drop-specific UI patterns (observed + inferred)

| Pattern | Seen on `1011209279` now? | Notes |
|---------|----------------------------|-------|
| Disabled ATC + visible label | **Yes** | Button stays in DOM; `waiting_disabled` is correct |
| No fulfillment tabs | **Yes** | Strong drop-OOS signal vs in-stock PDPs |
| `adapt_pdp_oos_01` placement | **Yes** | Redsky `strategy_description: "Find alternative"` |
| Sticky “Find alternative” | **Yes** | Do not click — opens alt-product UX |
| `NonbuyableSection` | **Yes** | Only on buybox-collapsed / non-buyable state |
| Final sale / no returns | **Yes** | `return_method: "No Return"` in Redsky |
| Purchase limit 2 | In Redsky | Enforced at cart/checkout |
| Countdown / “coming soon” | No | `street_date: 2026-06-19` already passed |
| Virtual queue / waiting room | No | Used on **some** mega-drops (separate flow, not this PDP today) |
| High-traffic modal | No | Community reports: “Please keep trying” during drops |
| Sign-in-to-buy-now | No (OOS) | May appear when in-stock on other SKUs |
| Notify me | No | Target email alerts lag real stock |

**Inferred in-stock state during drop** (from Redsky deltas, community reports, recent verified reviews dated 2026-06-25–28):

1. `#addToCartButtonOrTextIdFor1011209279` flips to **`disabled: false`** (likely `data-test="shippingButton"` or null).
2. Fulfillment tabs **appear** with shipping/pickup `IN_STOCK` and ATP &gt; 0.
3. Sticky bar shows **qty + enabled ATC**, not “Find alternative”.
4. `adapt_pdp_oos_01` carousel may shrink or defer.
5. `POST cart_items` returns **`201`** (with Shape `x-gyjwza5z-*` headers on UI-initiated clicks).
6. Window is **seconds** — inventory sells through network ATP immediately; cart lines can disappear at checkout under contention.

### 11.4 “Waiting for restock” vs “permanently OOS”

Target does not expose a reliable “gone forever” flag on the PDP. Use **combined signals**:

| Signal | Waiting for restock (keep polling) | Likely permanent / not buyable online |
|--------|-----------------------------------|---------------------------------------|
| Main TCIN button in DOM | Present (even if `disabled`) | **Absent** / PDP “page unavailable” |
| Body “Out of stock” | Yes | “Discontinued” / 404 / obsolete |
| Redsky `sold_out` | **`false`** (observed now) | `true` |
| Redsky `available_to_promise_quantity` | `0` now; watch for &gt; 0 | Stays `0` for weeks + `sold_out: true` |
| `POST cart_items` | `424 INVENTORY_UNAVAILABLE` | Same, but button never enables |
| `adapt_pdp_oos_01` placement | Active | N/A if product delisted |
| Fulfillment tabs | Hidden when fully OOS | — |
| Product still purchasable historically | Recent reviews confirm buys | — |

**For `1011209279` specifically:** Post-drop OOS with `sold_out: false` and active product page = **restock-possible** (Target TCG restocks are irregular). CookieScripts should **keep hard-refresh polling**, not treat as fatal error.

**Do not** use enabled recommendation buttons as a restock signal — they are always in-stock sibling SKUs.

### 11.5 What CookieScripts should do differently (drop class vs normal SKU)

| Behavior | Normal in-stock (e.g. tape) | Drop / TCG OOS-wait (e.g. `1011209279`) |
|----------|----------------------------|----------------------------------------|
| Pre-click fulfillment tab | Often needed (`fulfillment-cell-shipping`) | **Skip** — tabs absent until stock returns |
| Wait state | Brief hydration wait | **`waiting_disabled`** for extended periods — **correct** |
| Hard refresh interval | Optional | **Essential** — only path to catch enable flip |
| ATC selector | TCIN id + scope | **Same** — id stable even when `data-test` is null |
| Recommendation guard | Important | **Critical** — many enabled decoy buttons |
| Sticky bar | May confirm “N in cart” | **Ignore** “Find alternative” |
| Cart confirm | Header + modal | Same; expect lag during drops |
| API fast-path `fetch(cart_items)` | Works (`201`) | Returns **`424`** while OOS — use as **secondary** restock probe |
| Navigate checkout | After cart confirm | **Only** after `201` / cart confirm — empty cart checkout is useless |
| Captcha / Shape | Moderate | **Expect** heavy Redsky captcha + Shape on successful ATC |
| Purchase limit | Rarely hit | **2** — `minDelta` 1 is fine but user may want qty 2 |
| Failure mode | “Button not found” | **Never** click `chooseOptionsButton` when main is disabled |

**Existing code already handles the hardest drop problem** (`waiting_disabled` + TCIN-scoped id + recommendation exclusion). Gaps to consider:

1. Detect `NonbuyableSection` or missing fulfillment tabs → classify as **drop-wait** (status: “Waiting for restock…”).
2. Treat sticky text **“Find alternative”** as non-actionable (do not `activateElement`).
3. Optional: poll `POST cart_items` when button disabled; on `201` skip waiting for DOM enable (race DOM).
4. Surface `424 INVENTORY_UNAVAILABLE` in debug logs to distinguish from Shape blocks (`403`/`401`).
5. Do **not** reduce refresh interval below what Target rate-limits; captcha storms make it worse.

### 11.6 Reproduce

```bash
node extension/domains/target/scripts/target-drop-pdp.mjs
```

---

## 12. Legal / ToS note

Automating add-to-cart may violate [Target Terms of Service](https://www.target.com/c/terms). Bot circumvention (Shape) may have additional legal exposure. CookieScripts README already discloses this risk.

---

## Appendix: pages exercised

| URL | TCIN | Result |
|-----|------|--------|
| `/p/-/A-1011209279` (Pokémon TCG drop) | 1011209279 | **Post-drop OOS** — disabled ATC, no fulfillment tabs, `424` cart, `adapt_pdp_oos_01` |
| `/p/bounty-.../-/A-13276134` | 13276134 | Redirected to milk PDP, store OOS |
| `/p/tide-pods-.../-/A-14758404` | 14758404 | “Page unavailable” |
| `/p/scotch-3pk-magic-tape-.../-/A-13356914` | 13356914 | **In-stock pickup default; ATC POST captured** |
| `/checkout/start` | — | Checkout shell + guest sign-in flyout |
