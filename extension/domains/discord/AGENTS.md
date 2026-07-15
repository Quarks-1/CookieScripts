# Discord domain

Watches Discord channel tabs for product links and sends candidates to the background for allowlist filtering and tab opening.

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry.ts` |
| Session / observer | `content/session.ts` (`hookSpaNavigation`, `MESSAGE_BOOTSTRAP_QUIET_MS`), `observers.ts`, `extract.ts` |
| Domain detection | `content/detected-domains.ts`, `content/page-domains.ts` |
| DOM selectors | `content/selectors.ts` — **only** edit selectors here; bump `SELECTOR_VERSION` |
| Background handler | `background/handlers.ts` — link open (`openTargetLinkRepeated` in core `open-product-link.ts`) |
| Link pipeline (core) | `@ext/core/lib/process-links.ts`, `links.ts`, `validate.ts`, `affiliate-unwrap.ts`, `keywords.ts`, `retailer-url.ts` |

## Data flow

```mermaid
flowchart LR
  attach[channel attach] --> observer[observers]
  observer --> candidates[CANDIDATE_LINKS + message_text + anchors]
  candidates --> mode{sku_open_mode?}
  mode -->|off| processLinks[process-links]
  processLinks --> keywordGate[per-retailer keywords gate]
  mode -->|on| targetSku[Target SKU path]
  mode -->|on| walmartLinks[Walmart link path]
  keywordGate --> openTab[open-product-link]
  targetSku --> openTab
  walmartLinks --> openTab
```

## Messages

Source of truth: [extension/core/types/messages.ts](../../core/types/messages.ts). Handlers: `background/handlers.ts`. How to add/change: `.cursor/rules/runtime-messages.mdc`.

## Invariants

- Bootstrap quiet period (`MESSAGE_BOOTSTRAP_QUIET_MS` = 500ms in `session.ts`) prevents historical links on load.
- Empty allowlist = observe only; `process-links` no-ops on `[]`.
- Selectors only in `selectors.ts`; bump `SELECTOR_VERSION` after manual verification.
- Thread URLs share parent channel allowlist (`parseChannelId` uses parent segment).
- Own messages are skipped (`isOwnMessage` in extract/session).
- Prefer visible message `textContent` URLs over Discord redirect `href`s.
- `CANDIDATE_LINKS` may include optional `message_text`, `anchors`; extraction uses `messageScanRoot` (article + embed accessories).
- Per-channel **watch_keywords** (`target` / `walmart` buckets) gate auto-open per retailer URL (`shouldOpenByKeywords`); skipped links use history kind `keyword_skipped`.
- Global **SKU open mode** (`sku_open_mode_enabled`): Target opens via `decideSkuOpenAction` + `watch_skus.target` (constructed PDP); Walmart links still use link pipeline + Walmart keywords; other allowlisted domains are blocked. History kind `sku_skipped` when configured Target SKUs exist but none match.
- Side panel Channel filters: Target subsection (keywords + SKUs) and Walmart subsection (keywords only); settings debounce 400ms via `useChannelDiscordSettings`.
- When per-channel **Auto ATC** is enabled, Target product links open via `openTargetLinkRepeated` in core `open-product-link.ts` (repeat count from global `retailer_link_open_count`, default 1); other allowlisted links open via `openPassiveProductLink` in a new window or background tab per global `open_links_in_window` setting (default on).

Global invariants and import rules: [AGENTS.md](../../../AGENTS.md).

## Tests

`tests/discord/*`, `tests/core/handlers-discord.test.ts`, `tests/core/channel-targets.test.ts`, `tests/core/retailer-url.test.ts`

## UI

Side panel Channel filters (Target + Walmart keyword/SKU editor), detected links: `ui/popup/domains/discord/`. Link history uses `@shared/components/LinkHistory.tsx`.

Manifest: content script `run_at: document_idle` on `https://discord.com/channels/*`.
