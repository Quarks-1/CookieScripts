# Side panel UI (core)

React shell for the Chrome side panel — pinned header and domain tabs, scrollable domain panel bodies.

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
| Segment map | `sidepanel-tabs.ts` (`activeTabKindToSidepanelTab`) |
| Section gating | `sidepanel-layout.ts` (`isSectionVisible`) |
| Pinned shell | `components/SidepanelHeader.tsx`, `SidepanelContextBar.tsx` |
| Panel bodies | `panels/DiscordPanel.tsx`, `TargetPanel.tsx`, `WalmartPanel.tsx`, `SamsclubPanel.tsx`, `GlobalPanel.tsx` |
| Global hooks | `hooks/usePopupStatus.ts`, `hooks/useUpdateCheck.ts` |
| Shared components | `components/VersionStatus.tsx`, `ui/shared/components/*` |
| Background bridge | `@ext/core/lib/messages.ts` (`sendToBackground`, `getExtensionSettings`, `getSidePanelWindowId`) |
| Status source | `extension/core/background/status.ts` (`buildStatus`); `statusRevision` session key bumps on tab activation (`service-worker.ts`) |
| UI message handler | `extension/core/background/ui-handlers.ts` |

### Shared components (`ui/shared/components/`)

`EnableSlider`, `WatchStatusBadge`, `LinkHistory`, `CollapsiblePillList`, `DomainPills`, `DetectedLinkPills`, `KeywordPills`, `SkuPills`, `PillListSectionHeader`, `CompactNumberField`

## Layout

**Pinned shell** (sticky, always visible):

1. `SidepanelHeader` — title, version, Enable extension
2. `SidepanelContextBar` — clickable domain tabs (Discord · Target · Walmart · Sam's Club · Global). When the focused browser tab changes to a supported domain (`active_tab_kind` ≠ `other`), the side panel follows via `resolveSidepanelTabForActiveTabChange` in `sidepanel-tabs.ts`. Manual tab picks persist until `active_tab_kind` changes; unsupported tabs do not override the current selection.

**Scrollable panel body** — one panel mounted at a time (user-selected tab):

| Tab | Panel | Settings always visible |
|---|---|---|
| Discord | `DiscordPanel` | Yes — per-channel domains need a focused Discord channel tab; global keywords/SKUs always editable when extension is on |
| Target | `TargetPanel` | Yes — link opens, Enable Auto ATC, ATC toggles, hard refresh interval, etc. |
| Walmart | `WalmartPanel` | Yes — auto-refresh, queue helpers, recording |
| Sam's Club | `SamsclubPanel` | Yes — ATC toggles, auto checkout/CVV, manual auto mode, recording |
| Global | `GlobalPanel` | Open links in new window, SKU open mode, Show Walmart/Sam's Club recording |

Inactive panels unmount; domain hooks run only on the selected tab. Target/Walmart/Sam's Club panel hooks load settings regardless of whether a matching browser tab is focused. Start/Stop runtime controls on Target and Sam's Club still require a focused matching tab (`showControls={retailer_tab_detected}` / `showControls={samsclub_tab_detected}`).

## Section visibility (`isSectionVisible`)

Used inside domain panels for intra-panel gating:

| Section | Visible when |
|---|---|
| `watchStatus`, `channelDomains`, `detectedLinks`, `linkHistory` | `active_tab_kind === "discord_channel"` |
| `retailerAuto` | `enabled` and (`active_tab_kind === "retailer"` OR `any_retailer_tab_open`) |
| `walmartResearch` | `enabled` and (`active_tab_kind === "walmart"` OR `walmart_recording_active` OR `any_walmart_tab_open`) |
| `samsclubRecording` | `enabled` and (`active_tab_kind === "samsclub"` OR `samsclub_recording_active` OR `any_samsclub_tab_open`) |
| `samsclubAuto` | `enabled` and (`active_tab_kind === "samsclub"` OR `any_samsclub_tab_open`) |

**Exception:** `TargetAtcToggles` in `TargetPanel` renders when `status.retailer_tab_detected`, independent of `retailerAuto` gating. `RetailerAutoModeSection` shows tab pills when visible; Start/Stop controls render only when `retailer_tab_detected`.

**Exception:** `WalmartAutoRefreshSection` in `WalmartPanel` renders when `status.walmart_tab_detected`.

**Exception:** `SamsclubAtcToggles` in `SamsclubPanel` renders when `status.samsclub_tab_detected`, independent of `samsclubAuto` gating. `SamsclubAutoModeSection` shows tab pills when visible; Start/Stop controls render only when `samsclub_tab_detected`.

**Exception:** **Channel filters** (`ChannelFiltersSection`) renders in `DiscordPanel` on `discord_channel` surface.

**Note:** **Enable Auto ATC** (`retailer_auto_atc_enabled`, global) UI lives in `TargetAutoAtcSection` on the Target tab. Always toggleable when the extension is enabled.

**Note:** `sku_open_mode_enabled` UI lives in `GlobalPanel`. `retailer_link_open_count` UI lives in `TargetLinkSettingsSection` (Target tab). SKU mode applies to Target and Walmart configured SKU lists on the Discord tab.

## Domain UI map

| Domain | Path |
|---|---|
| Discord | `ui/popup/domains/discord/components/*`, `hooks/*` |
| Target | `ui/popup/domains/target/components/*`, `hooks/*` |
| Walmart | `ui/popup/domains/walmart/components/*`, `hooks/*` |
| Sam's Club | `ui/popup/domains/samsclub/components/*`, `hooks/*` |

### Hooks (by domain)

| Domain | Hooks |
|---|---|
| Core | `usePopupStatus`, `useUpdateCheck` |
| Discord (`DiscordPanel`) | `useChannelDiscordSettings`, `useGlobalDiscordWatchSettings`, `useDetectedLinks`, `useLinkHistory` |
| Target (`TargetPanel`) | `useRetailerLinkOpenCount`, `useRetailerAutoAtcEnabled`, `useRetailerAutoMode`, `useRetailerAtcMode`, `useRetailerAtcQuantity`, `useRetailerAutoCheckout` |
| Walmart (`WalmartPanel`) | `useWalmartRecording`, `useWalmartAutoRefresh`, `useWalmartQueueSettings` |
| Sam's Club (`SamsclubPanel`) | `useSamsclubAtcMode`, `useSamsclubAutoCheckout`, `useSamsclubCheckoutCvv`, `useSamsclubAtcQuantity`, `useSamsclubAutoMode`, `useSamsclubRecording` |

`LinkHistory` component lives in `@shared/components/LinkHistory.tsx` (not under discord domain).

## Messages

Source of truth: [extension/core/types/messages.ts](../../../extension/core/types/messages.ts). Handler: `extension/core/background/ui-handlers.ts`. How to add/change: `.cursor/rules/runtime-messages.mdc`.

Focused-window actions may pass optional `window_id`; hooks use `getSidePanelWindowId()`.

Walmart queue settings are exposed on `ExtensionStatus` (`walmart_queue_pass_sound_enabled`, `walmart_consolidate_queue_tabs_enabled`, `walmart_throttle_refresh_interval_sec`). Global Discord watch lists use `global_*_keywords` / `global_*_skus` on status. Persist via `getExtensionSettings` / `saveExtensionSettings` in hooks; add new panel fields to `buildStatus` + `types/status.ts` before wiring UI hooks.

## Panel hook seeding (no settings flash)

`App.tsx` loads `ExtensionStatus` once via `usePopupStatus` before rendering a panel. **Domain hooks must not paint hardcoded defaults and then `GET_STATUS` on mount.**

When a hook displays persisted settings:

1. Add fields to `ExtensionStatus` and `buildStatus` when missing (preferred — one load for the whole panel).
2. Accept a `status` slice (or full `ExtensionStatus`) from the panel component.
3. Initialize `useState` from that slice: `useState(() => status?.field ?? default)`.
4. `useEffect`-sync when `status` changes, skipping while `saving` / focused / pending debounce.
5. Reserve `GET_STATUS` / `getExtensionSettings` for post-save refresh and live runtime polling (e.g. manual auto status every 500ms).

`GlobalPanel` and `useRetailerAutoAtcEnabled` already read directly from `status`. `useLinkHistory` / `useDetectedLinks` are runtime fetches — loading states are intentional there.

## Invariants

- One hook per feature in `hooks/` or `ui/popup/domains/*/hooks/`.
- `App.tsx` is the only consumer of `usePopupStatus`; panels receive `onRefresh` when needed.
- Domain tabs auto-follow supported `active_tab_kind` changes; users can still pick another tab until the browser tab changes again. Do not gate panel settings on `active_tab_kind` (runtime actions may still require the matching browser tab).
- `buildStatus` in `status.ts` is the status contract — update `extension/core/types/status.ts` when adding fields.

Global invariants and import rules: [AGENTS.md](../../../AGENTS.md).

## Tests

`tests/core/*` — side panel layout, segment mapping, and UI handler status.
