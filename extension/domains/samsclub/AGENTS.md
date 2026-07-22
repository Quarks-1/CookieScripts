# Sam's Club domain

Manual drop-day research recorder on `samsclub.com` tabs, plus Target-like manual-start automation (ATC, hard refresh, checkout). **No Discord link opening.**

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry-early.ts` (`document_start` — pending start stash), `content/entry.ts` (`document_idle`) |
| Recorder session | `content/session.ts`, `content/recorder/*` |
| Automation session | `content/session/*`, `content/automation/*` |
| Background handlers | `background/handlers/{index,shared,recording-lifecycle,tab-events,append,ui-messages,content-messages,automation-messages}.ts` |
| Runtime state | `background/runtime-state.ts` (recording), `background/automation-runtime-state.ts` (automation tabs), `background/scheduled-auto.ts` |
| IDB / export | `lib/idb/*`, `background/export.ts` |
| Page probe | `lib/page-probe-bridge.ts` → `public/injected/samsclub-research-probe.js` |
| Cart probe | `lib/page-cart-probe-bridge.ts` → `public/injected/samsclub-cart-probe.js` |
| Throttle / transit | `lib/throttle-page.ts`, `content/session/transit-wait.ts` |
| Types | `types/samsclub.ts` |
| Docs | `docs/SAMSCLUB_RECORDING.md`, `docs/SAMSCLUB_AUTOMATION.md` |

## Recording flow

Same as Walmart: global session, IDB persistence, ZIP export. Toggle UI via **Global** panel → `samsclub_recording_ui_enabled`.

## Automation flow

Manual Start from Sam's Club side panel on an open `/ip/` tab → `SAMSCLUB_START_MANUAL_AUTO` → ATC loop → navigate to checkout.

Scheduled auto start/end mirrors Target via `samsclub_schedule_*` settings and `background/scheduled-auto.ts`. Stop-on-OOS applies during PDP wait only (no close-tab). Throttle/high-traffic pages hard-refresh during PDP wait (`waiting-disabled.ts`) and checkout transit (`transit-wait.ts`).

## Messages

Source of truth: [extension/core/types/messages.ts](../../core/types/messages.ts). Prefix: `SAMSCLUB_RECORDING_*` (recorder), `SAMSCLUB_*` (automation).

## Invariants

- Manual research + manual automation only — no Discord integration.
- Content never writes IndexedDB — background handlers persist.
- Inject research probe only while recording.
- Backend ATC runs in page context via `samsclub-cart-probe.js`.
- Checkout CVV accepts 3 or 4 digits (`lib/checkout/cvv.ts`).
- Hard refresh resume via tab `sessionStorage` (`cookiescripts:samsclubAutoResume`).
- Domain isolation — no cross-import with target/walmart/discord.

Manifest: early (`document_start`) + main (`document_idle`) on `samsclub.com` / `www.samsclub.com`.

## Tests

`tests/samsclub/*`

## UI

`ui/popup/domains/samsclub/` — recording section + automation settings + **schedule** (`SamsclubScheduleSection`) on **Sam's Club** side panel tab.
