# CookieScripts — Agent Guide

Chrome MV3 extension that auto-opens allowlisted product links from Discord web channel messages. Fork of [Quarks-1/autoopen](https://github.com/Quarks-1/autoopen) concepts; no Discord user token.

**Docs:** [BUILD.md](./BUILD.md) — product spec and upstream porting index. [README.md](./README.md) — install, update, permissions. **This file — how the codebase works today** (BUILD.md is partially stale; trust this file + code for current behavior).

## Product model

- User keeps `https://discord.com/channels/*` open; a content script observes the message list DOM.
- **Popup only** — no options page. Global enable slider; per-channel `allowed_domains` edited for the **active tab's channel** only.
- When enabled on a Discord channel tab, the extension **auto-scans** messages. Empty allowlist = observe but do not open links.
- Matched links open via `chrome.tabs.create({ active: false })` in the service worker.
- Distribution: manual zip from [GitHub Releases](https://github.com/Quarks-1/CookieScripts/releases) + popup update nudge (not Chrome Web Store).

### BUILD.md vs reality

| BUILD.md may still say | Current code |
|---|---|
| Options page + manual watch targets | Removed — popup is sole UI |
| Scan only pre-registered channels | Scan any channel tab when `enabled` |
| Domains required to attach observer | Domains gate **opening**, not observing |

## Architecture

```mermaid
flowchart LR
  subgraph discordTab [discord.com tab]
    CS[content/session.ts]
  end
  subgraph ext [Extension]
    SW[background/handlers.ts]
    Store[(chrome.storage.local)]
    POP[ui/popup React]
  end
  CS -->|CHANNEL_ACTIVE / CANDIDATE_LINKS| SW
  SW -->|filter dedup open tab| NewTab[chrome.tabs.create]
  SW <--> Store
  POP <-->|GET_STATUS SAVE_SETTINGS| SW
  CS <-->|WATCH_CONFIG| SW
```

## Where to edit

| Area | Path | Notes |
|---|---|---|
| Content orchestration | `extension/content/session.ts` | Channel sync, bootstrap, observer lifecycle |
| DOM selectors | `extension/content/selectors.ts` | **Only** Discord CSS selectors; bump `SELECTOR_VERSION` |
| Link extraction | `extension/content/extract.ts` | Use `textContent`, not `innerHTML` |
| Detected-domain scan | `extension/content/detected-domains.ts` | Page-load link suggestions for popup |
| Background | `extension/background/handlers.ts` | Message routing, tab opening, status |
| Pure logic | `extension/lib/*` | Testable; minimize `chrome.*` in lib modules |
| Popup UI | `ui/popup/` | Hooks in `hooks/`, sections in `components/` |
| Shared UI | `ui/shared/` | `DomainPills`, `LinkHistory`, `EnableSlider` |
| Dev UI preview | `ui/dev/` + `npm run dev:ui` | Mocked `chrome` APIs |
| Tests | `tests/` | Vitest; `happy-dom` for DOM tests |

## Storage (`extension/lib/constants.ts`)

| Key | Purpose |
|---|---|
| `cookiescripts:settings` | `{ enabled, channel_targets[] }` — targets created lazily from popup |
| `cookiescripts:history` | Opened/duplicate links, cap 200 |
| `cookiescripts:recentUrls` | Normalized dedup keys, cap 500 |
| `cookiescripts:updateCheck` | GitHub release ETag cache |
| `cookiescripts:ignoredDomains` | Per-channel dismissed detected-link suggestions |

## Runtime messages

Defined in `extension/types/index.ts`. Content → background: `CHANNEL_ACTIVE`, `CHANNEL_INACTIVE`, `CANDIDATE_LINKS`, `ADD_ALLOWED_DOMAIN`, `IGNORE_DOMAIN`. Background → content: `WATCH_CONFIG`, `SCAN_DETECTED_DOMAINS`. Popup ↔ background: `GET_STATUS`, `GET_SETTINGS`, `SAVE_SETTINGS`, `GET_HISTORY`, `CLEAR_HISTORY`, `GET_DETECTED_DOMAINS`. **Content script never opens tabs** — delegate to the service worker.

## Critical invariants / footguns

1. **Bootstrap on page load** — Seed existing message IDs into `seenMessageIds` on attach; hold link processing for `MESSAGE_BOOTSTRAP_QUIET_MS` (500ms) while Discord batches initial DOM. Without this, every historical link opens on load.
2. **Extension context invalidated** — After extension reload, stale content scripts must call `endSession()` and stop retrying `syncChannel`. Swallow invalidated errors in `requestWatchConfig` (`extension/lib/messages.ts`).
3. **Auto-scan semantics** — `watchConfigResponse` returns `channel_id` when `enabled` even if `allowed_domains` is `[]`. `isChannelActive` is `channel_id !== null`. `process-links.ts` no-ops on empty allowlist.
4. **Discord selectors** — Expect breakage; patch `selectors.ts` only, not core logic.
5. **Detected links UI** — Lives in popup (`DetectedLinksSection`), never as page overlays.
6. **Domain suggestions** — Canonicalize CDN/affiliate hosts via `suggestion-domains.ts` (`CANONICAL_SUFFIXES`); filter noise via `blocked-domains.ts` and `ignored-domains.ts`.
7. **No Discord token** — Never add `cookies`, `webRequest`, or `<all_urls>` permissions.
8. **CRXJS manifest** — Root `manifest.json` references **source** `.ts` / `.html` entrypoints, not `dist/` paths.
9. **Version check** — Conditional GET to GitHub on every popup open (ETag); 304 reuses cache. No time-based skip (`check-for-update.ts`).
10. **After service-worker changes** — Reload on `chrome://extensions`; refresh Discord tabs to avoid stale content scripts.

## Dev & test

```bash
npm install
npm run dev        # extension HMR
npm run dev:ui     # popup in browser with chrome mock
npm run build      # tsc -b && vite build → dist/
npm test           # vitest run
npm run package    # build + zip
```

Node 20+. Path aliases: `@ext` → `extension/`, `@shared` → `ui/shared/`. Unused imports fail `tsc -b`.

## CI & release

- `.github/workflows/ci.yml` — `npm ci && npm test && npm run build` on PR/main.
- `.github/workflows/release.yml` — every `main` push → patch version commit `[skip ci]` → tag `vX.Y.Z` → attach `cookiescripts-X.Y.Z.zip`.
- `git pull` after merges to pick up bot version bumps.

## Porting from autoopen

When changing link parsing, validation, or domain matching, check BUILD.md “Logic to port”. Primary files: `extension/lib/links.ts`, `validate.ts`, `affiliate-unwrap.ts`.

## Non-goals

- Chrome Web Store publishing
- Options page or manual channel-ID entry UI
- Firefox/Safari ports
- Gateway listener or stored Discord user token
- Detecting links added by message edits (planned v0.2+)
