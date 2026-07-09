# Side panel UI (core)

React shell for the Chrome side panel — section visibility, global hooks, status polling.

## Entry points

| Entry | Path | Role |
|---|---|---|
| Production | `ui/sidepanel/index.html` → `main.tsx` → `ui/popup/core/App.tsx` | Loaded by Chrome `side_panel.default_path` |
| Local preview | `ui/popup/core/main.tsx` via `ui/popup/index.html` | Vite dev only; not in extension package |

Shared styles: `@shared/index.css` (`ui/shared/`).

## Key files

| Area | Path |
|---|---|
| App shell | `App.tsx` |
| Section gating | `sidepanel-layout.ts` (`isSectionVisible`) |
| Global hooks | `hooks/usePopupStatus.ts`, `hooks/useUpdateCheck.ts` |
| Shared components | `components/VersionStatus.tsx`, `ui/shared/components/*` |
| Background bridge | `@ext/core/lib/messages.ts` (`sendToBackground`, `getExtensionSettings`, `getSidePanelWindowId`) |
| Status source | `extension/core/background/status.ts` (`buildStatus`) |
| UI message handler | `extension/core/background/ui-handlers.ts` |

### Shared components (`ui/shared/components/`)

`EnableSlider`, `WatchStatusBadge`, `LinkHistory`, `DomainPills`, `DetectedLinkPills`, `KeywordPills`

## Section visibility

| Section | Visible when |
|---|---|
| `watchStatus`, `channelDomains`, `detectedLinks`, `linkHistory` | `active_tab_kind === "discord_channel"` |
| `retailerAuto` | `active_tab_kind === "retailer"` and `enabled` |
| `walmartResearch` | `enabled` and (`active_tab_kind === "walmart"` OR `walmart_recording_active` OR `any_walmart_tab_open`) |
| `globalHint` | `active_tab_kind === "other"` |

**Exception:** `TargetAtcToggles` in `App.tsx` renders when `status.retailer_tab_detected` (focused Target tab), independent of `retailerAuto` section gating.

**Exception:** `WalmartAutoRefreshSection` renders when `status.walmart_tab_detected`, directly below Enable extension. It bundles hard-refresh auto-refresh **and** queue helpers (throttle refresh interval, pass sound, consolidate queue tabs) via `useWalmartAutoRefresh` + `useWalmartQueueSettings`.

**Exception:** **Enable Auto ATC** slider and **Link keywords** section render on `active_tab_kind === "discord_channel"` — not gated by `isSectionVisible`; Auto ATC configures per-channel Target automation; keywords filter all auto-opened links.

**Exception:** **Open links in new window** slider renders below **Enable extension** on all surfaces (not gated on `discordSurface`); persists `open_links_in_window` via `SAVE_SETTINGS`. `ExtensionStatus.open_links_in_window` reflects the stored preference (default true when omitted).

## Domain UI map

| Domain | Path |
|---|---|
| Discord | `ui/popup/domains/discord/components/*`, `hooks/*` |
| Target | `ui/popup/domains/target/components/*`, `hooks/*` |
| Walmart | `ui/popup/domains/walmart/components/*`, `hooks/*` |

### Hooks (by domain)

| Domain | Hooks |
|---|---|
| Core | `usePopupStatus`, `useUpdateCheck` |
| Discord | `useChannelDiscordSettings`, `useDetectedLinks`, `useLinkHistory` |
| Target | `useRetailerAutoMode`, `useRetailerAtcMode`, `useRetailerAtcQuantity`, `useRetailerAutoCheckout` |
| Walmart | `useWalmartRecording`, `useWalmartAutoRefresh`, `useWalmartQueueSettings` |

`LinkHistory` component lives in `@shared/components/LinkHistory.tsx` (not under discord domain).

## Messages

Source of truth: [extension/core/types/messages.ts](../../../extension/core/types/messages.ts). Handler: `extension/core/background/ui-handlers.ts`. How to add/change: `.cursor/rules/runtime-messages.mdc`.

Focused-window actions may pass optional `window_id`; hooks use `getSidePanelWindowId()`.

Walmart queue settings (`walmart_queue_pass_sound_enabled`, `walmart_consolidate_queue_tabs_enabled`, `walmart_throttle_refresh_interval_sec` in `types/core.ts`) persist via `getExtensionSettings` / `saveExtensionSettings` — **not** separate `UiToBackground` messages.

## Invariants

- One hook per feature in `hooks/` or `ui/popup/domains/*/hooks/`.
- `buildStatus` in `status.ts` is the status contract — update `extension/core/types/status.ts` when adding fields.

Global invariants and import rules: [AGENTS.md](../../../AGENTS.md).

## Tests

`tests/core/*` — side panel layout and UI handler status.
