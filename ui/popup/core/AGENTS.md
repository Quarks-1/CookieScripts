# Side panel UI (core)

React shell for the Chrome side panel — section visibility, global hooks, status polling.

## Key files

| Area | Path |
|---|---|
| Production entry | `ui/sidepanel/main.tsx` → `ui/popup/core/App.tsx` |
| Section gating | `sidepanel-layout.ts` (`isSectionVisible`) |
| Global hooks | `hooks/usePopupStatus.ts`, `hooks/useUpdateCheck.ts` |
| Shared components | `components/VersionStatus.tsx`, `ui/shared/components/*` |
| Status source | `extension/core/background/status.ts` (`buildStatus`) |
| UI message handler | `extension/core/background/ui-handlers.ts` |

## Section visibility

| Section | Visible when |
|---|---|
| `watchStatus`, `channelDomains`, `detectedLinks`, `linkHistory` | `active_tab_kind === "discord_channel"` |
| `retailerAuto` | `active_tab_kind === "retailer"` and `enabled` |
| `walmartResearch` | `enabled` and (`active_tab_kind === "walmart"` OR `walmart_recording_active` OR `any_walmart_tab_open`) |
| `globalHint` | `active_tab_kind === "other"` |

**Exception:** `TargetAtcToggles` in `App.tsx` renders when `status.retailer_tab_detected` (focused Target tab), independent of `retailerAuto` section gating.

**Exception:** `WalmartAutoRefreshSection` renders when `status.walmart_tab_detected`, directly below Enable extension.

## Domain UI map

| Domain | Path |
|---|---|
| Discord | `ui/popup/domains/discord/components/*`, `hooks/*` |
| Target | `ui/popup/domains/target/components/*`, `hooks/*` |
| Walmart | `ui/popup/domains/walmart/components/*`, `hooks/*` |

## Messages

`UiToBackground` type names in [extension/core/types/messages.ts](../../../extension/core/types/messages.ts): `GET_STATUS`, `GET_SETTINGS`, `SAVE_SETTINGS`, `GET_HISTORY`, `CLEAR_HISTORY`, `GET_DETECTED_DOMAINS`, `SET_RETAILER_*`, `RETAILER_START_MANUAL_AUTO`, `RETAILER_STOP_MANUAL_AUTO`, `WALMART_RECORDING`.

Focused-window actions may pass optional `window_id`; hooks use `getSidePanelWindowId()`.

## Invariants

- One hook per feature in `hooks/` or `ui/popup/domains/*/hooks/`.
- `buildStatus` in `status.ts` is the status contract — update `extension/core/types/status.ts` when adding fields.

Global invariants and import rules: [AGENTS.md](../../../AGENTS.md).

## Tests

`tests/core/sidepanel-layout.test.ts`, `tests/core/ui-handlers-status.test.ts`
