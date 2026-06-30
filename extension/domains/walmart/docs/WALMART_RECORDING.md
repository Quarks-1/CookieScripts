# Walmart live-drop research recorder

Manual research tool for capturing Walmart queue → product → ATC → checkout flows during real drops. **Not** auto-checkout and **not** wired to Discord link opening.

## What it captures

- Clicks with aria/text labels and generated element descriptors
- SPA navigations (no duplicate `session_start` on reload reattach)
- Page HTML snapshots (probe script stripped from HTML; `__NEXT_DATA__` and JSON-LD embedded)
- Open dialog HTML when `[role=dialog]` is present
- Cookie **names** only (values never captured)
- `localStorage` / `sessionStorage` key names on session start, navigation, and markers
- Debounced DOM button summaries and disabled-state polling for tracked buttons
- Form submit and Enter-in-form events
- All page-origin network: `fetch`, `XHR`, `sendBeacon`, WebSocket, plus Performance API resource timing backfill
- Network correlation IDs, absolute URLs, GraphQL operation names, redacted headers
- Failed fetch / zero-status XHR flagged as `failed: true`
- Fixed timeline markers (manual) plus URL-based **auto-markers** (blocked, queue, search, PDP, PAC, cart, pre-checkout with step detail, post-checkout)
- DOM signals in `dom_summary` (`px_captcha`, `atc_skeleton`, `atc_disabled`, OOS copy, payment iframe mount)
- `graphqlSignal` on network events (`gql_atc`, `gql_cart_read`, `gql_cart_init`); orchestra HTTP 412/418/429/456/521 flagged as failed
- `data-dca-event` / `data-dca-aid` / `data-dca-intent` on click descriptors
- `nextDataHints` (`usItemId`, `offerId`, `availabilityStatus`, `cartId`, `pcid`) in page snapshots
- Payment iframe `src` for `data-testid="pciContent"` (no card data)

See also [WALMART_AUTOMATION.md](./WALMART_AUTOMATION.md) for full flow research from cloud exploration.

## How to use on drop day

1. Load the extension and open the side panel.
2. **Start recording** from Discord (zero Walmart tabs is OK) or from an active Walmart tab — one session spans **all** `walmart.com` tabs in **every Chrome window**.
3. Accept the one-time sensitive-data disclaimer on first use.
4. Discord-opened background product tabs auto-attach as recording progresses (`tab_join` events in timeline).
5. Tap marker buttons on the **focused Walmart tab** as you pass each phase (optional but recommended).
6. Press **Stop recording** when done — one merged ZIP downloads.

**Multi-tab:** Events include `tabId`. Page snapshots are stored as `pages/t{tabId}-{index}-{slug}.json`.

**Tab close:** Closing one of several recorded tabs emits `tab_leave` and keeps recording. Closing the **last** recorded tab auto-exports.

**Navigate away:** Leaving `walmart.com` in a recorded tab emits `tab_leave` and unbinds; returning to Walmart re-attaches as a late join.

**Reload:** Mid-recording page reloads resume the same session via `sessionStorage` + background `REATTACH`.

**Stop with no tabs:** Start on Discord, then Stop before any Walmart tab attaches — session is discarded with no ZIP.

**Avoid** reloading the extension (`chrome://extensions`) during an active drop — use persisted session id + per-tab reattach if the service worker restarts.

## Export location

ZIPs download to:

```text
~/Downloads/CookieScripts/walmart-live/{YYYY-MM-DD}/session-{HHmmss}.zip
```

Chrome may prompt “Ask where to save each file” depending on browser settings; the side panel shows the full path after export.

Inside the ZIP:

| File | Contents |
|------|----------|
| `manifest.json` | Session metadata, `tabIds`, `primaryTabId`, `tabCount`, truncation flags |
| `summary.json` | Marker list, unique URLs, tab URLs, counts |
| `timeline.jsonl` | All events, one JSON object per line |
| `network.jsonl` | Network + WebSocket events only |
| `endpoints.json` | Deduplicated endpoint catalog |
| `pages/t{tabId}-*.json` | HTML snapshots per tab |

## Unpack for analysis

```bash
mkdir -p research/walmart-live
unzip ~/Downloads/CookieScripts/walmart-live/2026-06-29/session-143022.zip -d research/walmart-live/
```

Compare `timeline.jsonl` and `network.jsonl` across drops to spot new endpoints or DOM changes.

## Drop-day checklist

1. Confirm extension version in side panel update banner matches your installed build.
2. Open Walmart in a dedicated window; log in before the drop if checkout capture matters.
3. **Start recording** before queue opens — auto-markers fire on URL patterns but manual markers are still best for "Past queue".
4. Keep the tab focused during queue transitions when possible (background throttling can delay probes).
5. Tap markers at each phase even when auto-markers fire (manual markers drive page snapshot filenames).
6. **Stop recording** before closing the tab unless you want auto-export on tab close.
7. Verify export: `manifest.json` should list `extensionVersion`, `probeVersion`, and `truncated: false` when possible.
8. Check `endpoints.json` is non-empty after a checkout flow — empty catalog usually means relative URLs were not resolved (fixed in v0.1.18+).
9. If `droppedEvents` > 0, note whether you hit the 25 MB session cap; re-run a shorter focused session if needed.

## Limits

| Limit | Value | Behavior |
|-------|-------|----------|
| Session byte budget | 25 MB | Shared across all tabs; sets `manifest.truncated: true` |
| Page HTML session budget | 8 MB | Contributes to truncation |
| Network session budget | 17 MB | Contributes to truncation |
| Page HTML cap | 500 KB per snapshot | Truncated with `[truncated]` suffix |
| Network body | 64 KB (8 KB when truncated) | Bodies redacted + capped |
| Retained sessions (IDB) | 10 | Oldest pruned on new session start |
| Append chunk | 512 KB | Oversized batches split across multiple appends (single events may still drop if alone > 512 KB) |

## Truncation interpretation

When `truncated: true` in `manifest.json`:

- Later page snapshots may be omitted (`allowPageHtml: false`).
- Network bodies use the smaller cap.
- `droppedEvents` counts events skipped after the budget was hit.

Re-export the last stopped session from the side panel if the download failed.

## Privacy

Exports may contain page HTML and form-like request bodies. Review before sharing. The recorder redacts known sensitive header names and JSON keys but cannot guarantee zero PII — treat exports as confidential.

## Related code

- Content: `extension/domains/walmart/content/`
- Background: `extension/domains/walmart/background/`
- IDB stores: `extension/domains/walmart/lib/idb/`
- Injected probe: `public/injected/walmart-research-probe.js`
