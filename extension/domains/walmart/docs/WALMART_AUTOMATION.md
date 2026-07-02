# Walmart.com Guest Purchase Flow — Research Notes

Research date: 2026-06-29. Method: Playwright-driven Chrome (real channel, non-headless) on a cloud VM, plus in-page `fetch()` from a warm `walmart.com` session to bypass PerimeterX full-navigation blocks. Guest user, no login, no purchase completed.

Artifacts: `research/walmart-research-output/` (`inpage-fetch.json`, `live-home.json`, `report.json`, scripts).

---

## Flow map

| Step | URL / route | What happens |
|------|-------------|--------------|
| 1. Homepage | `https://www.walmart.com/` | Next.js SSR (`__NEXT_DATA__.page = "/"`). Location modal, VA consent dialog, PX “Robot or human?” press-hold captcha possible. Header shows pickup/delivery (GIC). `MergeAndGetCart` fires on load. |
| 2. Search | `https://www.walmart.com/search?q={query}` | SPA/SSR route `/search`. Product tiles with inline ATC. Filters: fulfillment method/speed, price, brand, etc. |
| 3. PDP | `https://www.walmart.com/ip/{slug}/{usItemId}` or `/ip/{usItemId}` | Next route `/ip/[...itemParams]`. Canonical slug redirect. Fulfillment tiles (shipping / pickup / delivery), subscription options, `add-to-cart-skeleton` → ATC button. Variant products use tile selectors. |
| 4. Bot block (common) | `https://www.walmart.com/blocked?url={base64Path}&uuid={}&vid={}&g=b` | PerimeterX challenge. `url` is base64 original path (e.g. `L2NhcnQ=` → `/cart`). Press-hold captcha in `#px-captcha` iframe. |
| 5. Add to cart | Same PDP or tile | `data-dca-event="addToCart"`. Network: `updateItems` mutation → `/orchestra/home/graphql` (POST, persisted hash). May redirect/flyout to PAC. |
| 6. PAC (optional) | `https://www.walmart.com/pac` | Post-add “protect your purchase” / warranty upsell. Continue / No thanks / View cart. |
| 7. Mini-cart | Header `#cart-button-header` | Flyout overlay; not a separate URL. |
| 8. Cart | `https://www.walmart.com/cart` | CSR shell; cart body hydrated client-side via `getCart` (GET persisted query). Empty cart is small SSR shell (~140KB). |
| 9. Checkout entry | `https://www.walmart.com/checkout` | Returns **521** / error page when no active checkout session (observed guest, empty cart). |
| 10. Review order | `https://www.walmart.com/checkout/review-order` | SSR shell with `__NEXT_DATA__` keys: `cartId`, `pcid`, `cid`. `data-testid="pciContent"` (payment iframe mount). |
| 11. Shipping | `https://www.walmart.com/checkout/shipping` | Checkout step route (blocked on cold navigation without session). |
| 12. Payment | `https://www.walmart.com/checkout/payment` | Payment step; PCI content likely iframe-hosted. |
| 13. Place order | `https://www.walmart.com/checkout/place-order` | Final submit step (not exercised). |
| 14. Guest path | Modal on checkout | “Continue as guest” / “Check out as guest” (not reached live; standard Walmart pattern after cart CTA). |
| 15. Queue (drop day) | Product-specific / soft launch | High-demand drops (consoles, sports cards) use a **waiting queue**; bots report no reliable bypass. Site may be unstable when queue opens. Not reproduced off-drop. |

**Navigation note:** Full `page.goto()` to PDP/cart/checkout often triggers PX **307 → /blocked** from datacenter/automation IPs. In-page `fetch('/ip/...')` from a warm homepage tab returned **200** with full SSR HTML and `__NEXT_DATA__`. SPA `history.pushState` updates the URL bar but may not re-render PDP content (observed homepage carousel ATC buttons persisting on `/ip/...` URL).

---

## Critical API endpoints discovered

### Orchestra GraphQL (persisted queries)

Pattern:
- **GET:** `https://www.walmart.com/orchestra/{home\|cartxo}/graphql/{OperationName}/{sha256Hash}?variables={urlencodedJSON}`
- **POST:** `https://www.walmart.com/orchestra/{home\|cartxo}/graphql/{OperationName}/{sha256Hash}` with JSON body `{ "variables": {...} }`

| Host | Path pattern | Operation | When fired | Notes |
|------|--------------|-----------|------------|-------|
| `www.walmart.com` | `/orchestra/home/graphql/Location/{hash}` | `Location` | Homepage load | GET; observed correlation id `x-o-correlation-id` |
| `www.walmart.com` | `/orchestra/home/graphql/GlobalIntentCenter/{hash}` | `GlobalIntentCenter` | Header pickup/delivery (GIC) | GET; store/zip intent |
| `www.walmart.com` | `/orchestra/home/graphql/shippingCountryList/{hash}` | `shippingCountryList` | Checkout/intl | GET |
| `www.walmart.com` | `/orchestra/cartxo/graphql/MergeAndGetCart/{hash}` | `MergeAndGetCart` | Homepage / session start | POST; creates/merges guest cart |
| `www.walmart.com` | `/orchestra/home/graphql/getCart/{hash}` | `getCart` | `/cart` hydration | GET; preferred read path per SPA |
| `www.walmart.com` | `/orchestra/home/graphql/updateItems/{hash}` | `updateItems` | ATC, qty change, remove | POST; needs `offerId` from PDP `__NEXT_DATA__` |
| `www.walmart.com` | `/orchestra/home/graphql/nearByNodes/{hash}` | `nearByNodes` | Store pickup / location | POST (documented) |

Checkout-related ops (documented / inferred, not live-captured): `createPurchaseContract`, `setShippingAddress`, `setPayment`, `placeOrder` or similar — names vary by deploy; inspect checkout network on a real session.

### Non-GraphQL orchestra

| Host | Path | When |
|------|------|------|
| `www.walmart.com` | `/orchestra/api/ccm/v3/bootstrap?configNames=account,ads,...,cart,checkout,product,search,...` | App bootstrap (~70 config modules) |
| `www.walmart.com` | `/orchestra/api/ccm/v1/bootstrap/web?configNames=...` | Older bootstrap variant |

### Ads / telemetry

| Host | Path | Operation |
|------|------|-----------|
| `www.walmart.com` | `/swag/graphql` | `AdV2DisplayDSP`, `AdV3DisplayDSP` |
| `b.www.walmart.com` | `/rum.gif`, `/log.gif` | RUM beacons |
| `b.www.walmart.com` | `/rum.js` | Pulse loader |
| `www.walmart.com` | `/si/elh9ie/obs` | Observability (`tenant-id: elh9ie`) |
| `www.walmart.com` | `/si/snr.js` | Sensor script |

### Bot mitigation (must record on drop day)

| Host | Path | Purpose |
|------|------|---------|
| `www.walmart.com` | `/px/PXu6b0qd2S/init.js`, `/px/PXu6b0qd2S/captcha/captcha.js` | PerimeterX / HUMAN |
| `collector-pxu6b0qd2s.px-cloud.net` | `/api/v2/collector` | PX telemetry POST |
| `collector-pxu6b0qd2s.px-client.net` | (beacon) | PX client |
| `fst-ec.perimeterx.net` | | PX edge |

### Headers (orchestra calls)

Observed / required bundle:
- `x-apollo-operation-name: {OperationName}`
- `x-o-correlation-id`, `wm_qos.correlation_id` (match)
- `x-o-platform: rweb`
- `x-o-segment: oaoh`
- `x-o-bu: WALMART-US`, `x-o-mart: B2C`
- `x-o-ccm: server`
- `tenant-id: elh9ie`
- `wm_mp: true`
- `x-o-platform-version: usweb-{semver}` (e.g. `usweb-1.256.1`)
- `wm-client-traceid`, `traceparent`, `x-latency-trace: 1`
- `wm_page_url: {current page}`
- `x-o-gql-query: query {name}` or `mutation {name}`

Missing headers → **412**, **418**, or **429** (Akamai shape detection, not just cookie/IP).

---

## DOM / selectors worth recording

### Global header
| Selector | Element |
|----------|---------|
| `data-automation-id="header-input-search"` | Search input |
| `data-testid="search-form"` | Search form (GET `/search`) |
| `data-automation-id="cart-button-header"` / `#cart-button-header` | Cart icon |
| `data-testid="gic-wrapper"` | “Pickup or delivery?” |
| `data-automation-id="headerSignIn"` | Sign in |

### Search results
| Selector | Element |
|----------|---------|
| `data-automation-id="product-title"` | Product link |
| `data-automation-id="add-to-cart"` | Tile ATC (“Add”) |
| `data-automation-id="product-price"` | Price |
| `data-item-id` | Tile wrapper |
| `a[link-identifier="itemClick"]` | Legacy click tracking |
| `data-testid="item-stack"` | Results stack |

### PDP
| Selector | Element |
|----------|---------|
| `data-automation-id="add-to-cart-button"` | Primary PDP ATC (common; verify on live PDP) |
| `data-automation-id="add-to-cart"` | Alternate ATC (tiles / some layouts) |
| `data-testid="add-to-cart-skeleton"` | ATC loading |
| `data-dca-event="addToCart"` | Analytics intent (also on buttons) |
| `data-dca-aid`, `data-dca-intent` | DCA telemetry attrs |
| `data-testid="ip-fulfillment-container-div"` | Fulfillment block |
| `data-testid="fulfillment-zone-1"` | Shipping / pickup / delivery tiles |
| `data-testid="shipping-tile"`, `pickup-tile`, `delivery-tile` | Fulfillment options |
| `data-testid="price-wrap"` | Price block |
| `aria-label^="Add to cart"` | Accessible ATC label (includes product name) |
| `aria-disabled="true"` | OOS / disabled ATC |

### OOS / limits (text + state)
- Button text: “Out of stock”, “Sold out”, “Get in-stock alert”
- `aria-disabled="true"` on ATC
- Disabled primary button + restock messaging in fulfillment zone

### Cart / checkout
| Selector | Element |
|----------|---------|
| `data-automation-id="checkout-button"` | Proceed to checkout (expected) |
| `data-testid="checkout-button"` | Alternate |
| `data-automation-id="guest-checkout"` | Guest CTA (expected) |
| `data-testid="pciContent"` | Payment iframe container |
| `[role="dialog"]` + `OverlayScrim_scrim` | Modals (consent, PX captcha) |
| `#px-captcha` | PX press-hold widget |

### Queue (drop day — July 2026 sessions)

**URL:** `https://www.walmart.com/qp?qpdata=…` (not `/queue/…`). Page kind: `queue`.

**Queue API** (`q-api.www.walmart.com`):
| Endpoint | Signal |
|----------|--------|
| `validateTickets` | Ticket `state: "valid"` → queue pass; `pending` → consolidation trigger |
| `issueTicket` | HTTP 200 → consolidation trigger |

**DOM copy variants:**
| Pattern | Meaning |
|---------|---------|
| `N item(s) ready to buy` | Homepage queue banner (`[data-testid="queue-banner"]`) — pass signal |
| `Hold tight` + `high traffic` / `load this page when it's ready` | Throttle page — auto hard-refresh |
| `We'll load this page when it's ready` | Throttle page |
| `Highly requested` + `refresh when available` | Throttle page |
| `almost gone`, `hang tight- we'll notify`, `hold my spot` | Queue-wait — **not** throttle |

**Extension helpers (when enabled):**
- Sound on queue pass (network valid ticket, banner ready-count increase, `/qp` → `/ip/` nav)
- Tab consolidation: close extra `/qp` tabs; keep homepage or lowest tabId `/qp`
- Throttle auto-refresh: global interval (default 10s), per-tab clock; reuses `WALMART_HARD_RELOAD`

**Recording:** auto-marker `Joined queue` on `/qp`; `Past queue` on pass (recording tab only).

### Queue (drop day — partial, pre-session)
- No live queue DOM captured off-drop.
- Bot docs: queue is mandatory for console/card drops; expect hold page + position UI.
- Auto-marker: URL may stay on PDP while overlay/iframe queue runs; watch for GraphQL ops with `queue` in name and non-200 on `updateItems`.

### Captcha / block
| Signal | Selector / URL |
|--------|----------------|
| Block page | `/blocked?url=` |
| Captcha dialog | `h2: "Robot or human?"`, `#px-captcha iframe` |
| PX script | `/px/PXu6b0qd2S/` |

---

## WebSocket / SSE / other transports

| Transport | Observed | Notes |
|-----------|----------|-------|
| WebSocket | **None** in ~3 min of flows | Inventory/queue may use WS on drop day — not seen off-drop |
| SSE | Not observed | |
| `sendBeacon` | `rum.gif`, `log.gif` | Already partially covered by probe |
| Partytown worker | `POST /~partytown/proxytown` (100+ calls) | Offloads 3rd-party scripts to web worker; **not** plain fetch/XHR |
| Service worker | `/~partytown/partytown-sw.js` scope `/~partytown/` | Separate from main app SW |
| `blob:` script URLs | Multiple per page | Dynamic script injection |

---

## Storage keys observed

### localStorage
`io_lid`, `io_olid`, `io_lspt`, `nudgeCounter`, `renderViewId`, `oneTapSession`, `cv.v1-US-JOURNEY`, `gep-callout-nudge-display-count`, `expiry-gep-callout-nudge`, `sparky.chat.first.seen`, `sparky.fab.home.seen.count`, `_bc_pulse_seq_num`, `_bc_pulse_batch_seq_num`, `PXu6b0qd2S_px_fp`, `PXu6b0qd2S_px_hvd`, `PXu6b0qd2S_px-ff`

### sessionStorage
`va-notice-seen`, `pxsid`, `show-location-nudge`, `is3pcSupported`, `_bc_cpv_id`, `_bc_rpv_id`, `_bc_prev_url`, `_bc_cur_url`, `_bc_batch_evts`, `io_sstk`, `PXu6b0qd2S_px_c_p_PXu6b0qd2S`, `PXu6b0qd2S_px_nfsp`

### Cookies (security-relevant)
| Cookie | Role |
|--------|------|
| `_px3`, `_pxde`, `_pxhd`, `_pxvid`, `pxcts` | PerimeterX |
| `ak_bmsc`, `bm_mi`, `bm_sv`, `akavpau_p*` | Akamai bot manager |
| `TS*` (multiple) | F5 / edge session |
| `isoLoc` | Geo (e.g. `US_VA_t3`) |
| `vtc`, `bstc`, `btc`, `bsc` | Tracking / session |
| `io_id`, `if_id` | Identity / fingerprint |
| `va-notice-seen` | Virginia consent |

---

## Third-party domains (critical)

| Host | Role |
|------|------|
| `collector-pxu6b0qd2s.px-cloud.net` | PX collector (**P0**) |
| `collector-pxu6b0qd2s.px-client.net` | PX client |
| `fst-ec.perimeterx.net` | PX |
| `b.www.walmart.com`, `b.wal.co` | Beacons |
| `i5.walmartimages.com`, `i5.wal.co` | CDN / ads |
| `gum.criteo.com`, `gum.us.criteo.com` | Criteo |
| `tpc.googlesyndication.com` | Ads |
| Payment PCI host | Inside `pciContent` iframe (not resolved guest-off-drop) |

---

## Gaps vs current recorder

| Priority | Gap | What's missing | Recommended capture |
|----------|-----|----------------|---------------------|
| **P0** | PerimeterX / block flow | `/blocked` URL, `#px-captcha`, `collector-pxu6b0qd2s.*` traffic | Auto-marker `url.pathname === '/blocked'`; record PX collector host in network filter; snapshot captcha dialog HTML |
| **P0** | `data-dca-*` attrs | `data-dca-event`, `data-dca-aid`, `data-dca-intent` on ATC/checkout | Add to click descriptor extraction |
| **P0** | `/swag/graphql` | Ad GraphQL not in `orchestra/graphql/api` filter | Extend filter: `swag/graphql` |
| **P0** | `/orchestra/api/ccm/*` bootstrap | CCM v3 bootstrap not captured | Add `orchestra/api` to network filter; log `configNames` query param |
| **P1** | Partytown proxy | `~partytown/proxytown` worker RPC | Hook `Worker.postMessage` or mark proxytown POSTs |
| **P1** | `getCart` vs `updateItems` | Cart **read** (GET) vs **write** (POST) | Tag mutations separately; correlate with ATC clicks |
| **P1** | PAC page | `/pac` warranty interstitial | URL auto-marker `pathname.startsWith('/pac')` |
| **P1** | Checkout step URLs | `/checkout/review-order`, `/shipping`, `/payment`, `/place-order` | URL markers for each step; parse `cartId`/`pcid` from `__NEXT_DATA__` |
| **P1** | Payment iframe | `data-testid="pciContent"` | Record iframe `src` + sandbox attrs; snapshot on checkout steps |
| **P1** | HTTP error codes | 412, 418, 429, 456, 521 | Log status on orchestra responses; **456** = queue/proxy block per bot docs |
| **P2** | Fulfillment selection | `shipping-tile`, `pickup-tile`, `delivery-tile` | Poll selected tile + disabled ATC in fulfillment zone |
| **P2** | `add-to-cart-skeleton` | Loading state before ATC live | Marker: skeleton present → ATC imminent |
| **P2** | Akamai cookies | `ak_bmsc`, `bm_*` rotation | Cookie name list already captured; add **value length / change events** on drop |
| **P2** | DCA dialog overlays | `OverlayScrim_scrim` blocking clicks | Dialog HTML + scrim presence in snapshots |
| **P2** | `__NEXT_DATA__` product fields | `offerId`, `usItemId`, `availabilityStatus` | Parse from PDP snapshot for offline correlation |
| **P3** | Blob scripts | `blob:https://www.walmart.com/...` | PerformanceObserver script entries |
| **P3** | Mobile vs desktop | `ip-atc-mweb-fixed` testid | Record viewport + user-agent; tag surface `desktop`/`mweb` |
| **P3** | VA consent / GEP modals | `va-notice-seen`, Virginia dialog | Marker on consent dialog |

---

## Drop-day checklist additions

### Auto-markers (URL)
- `BLOCKED` — `/blocked`
- `QUEUE_SUSPECTED` — high latency + repeated `updateItems` 412/429/456
- `PAC` — `/pac`
- `CART` — `/cart`
- `CHECKOUT_REVIEW` — `/checkout/review-order`
- `CHECKOUT_SHIPPING` — `/checkout/shipping`
- `CHECKOUT_PAYMENT` — `/checkout/payment`
- `CHECKOUT_PLACE_ORDER` — `/checkout/place-order`
- `PDP` — `/ip/` path
- `SEARCH` — `/search`

### Auto-markers (network)
- `GQL_ATC` — `x-apollo-operation-name: updateItems`
- `GQL_CART_READ` — `getCart`
- `GQL_CART_INIT` — `MergeAndGetCart`
- `GQL_LOCATION` — `Location`, `GlobalIntentCenter`
- `PX_COLLECTOR` — POST `collector-pxu6b0qd2s`
- `HTTP_456` — status 456 on any walmart.com request

### Auto-markers (DOM)
- `PX_CAPTCHA` — `#px-captcha` or dialog “Robot or human?”
- `ATC_DISABLED` — ATC `aria-disabled=true` or disabled
- `ATC_SKELETON` — `[data-testid="add-to-cart-skeleton"]`
- `OOS_COPY` — text “Out of stock” / “Sold out”
- `GUEST_CHECKOUT` — button text match guest patterns

### Correlation
- Tie `wm_qos.correlation_id` / `x-o-correlation-id` across click → `updateItems` → `getCart` → checkout mutations.
- Extract `offerId` + `usItemId` from PDP `__NEXT_DATA__` at ATC time.

---

## Non-goals / can't capture without login

- **Place order / payment tokenization** — PCI iframe requires live checkout session; do not record PAN/CVV.
- **Walmart+ / saved payment / 1Pay wallet** — account-bound.
- **OTP / passcode verification** — triggered for account phone verification at checkout.
- **Purchase history GraphQL** (`PurchaseHistoryV2`, `getOrder`) — auth cookies required.
- **Queue bypass internals** — no public queue API; drop-day queue UI not available off-drop.
- **Affiliate API** (`developer.api.walmart.com`) — separate API key auth, not storefront flow.
- **True inventory WebSocket** — not observed; speculatory for drops.

---

## Error / edge states

| State | Signal |
|-------|--------|
| PX block | 307 → `/blocked`, captcha modal |
| GraphQL preflight fail | 412 on `orchestra/home/graphql` |
| Bot shape detection | 418 / 429 on orchestra |
| Queue/proxy block | **456** (per botting docs) |
| Empty checkout | **521** on `/checkout` without session |
| Rate limit | 429 on `updateItems` / `MergeAndGetCart` |
| OOS | Disabled ATC + copy |
| Qty limit | Toast/modal after `updateItems` error (capture response body) |
| Site degradation | Multiple 5xx, empty search stacks, CCM bootstrap fail |

---

## Mobile vs desktop

- Desktop research (1440×900). Mobile-specific: `data-testid="ip-atc-mweb-fixed"` (sticky mweb ATC).
- Walmart mweb may use different checkout layout; recorder should tag viewport.
- Bot docs: mobile endpoints sometimes less aggressive — do not assume parity.

---

## Research limitations

1. **PerimeterX** blocked full `page.goto()` to PDP/cart/checkout from automation IP after first navigation; in-page `fetch()` succeeded intermittently.
2. **Guest checkout** not reached — empty cart / block prevented “Continue to checkout”.
3. **Queue** not live — patterns from bot community docs only.
4. **WebSockets** — none observed; may appear during drops.

Re-run locally: load extension in Chrome on residential IP, walk flow manually with recorder on; use saved session 30–60 min before drop.
