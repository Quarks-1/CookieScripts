# Walmart domain

Manual drop-day research recorder on `walmart.com` tabs. Multi-tab global session, IndexedDB persistence, ZIP export. **No auto-checkout, no Discord link opening.**

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry.ts` |
| Recorder | `content/recorder/*` |
| Background handlers (split) | `background/handlers/{index,shared,recording-lifecycle,tab-events,append,ui-messages,content-messages}.ts` |
| IDB / export | `lib/idb/*`, `background/export.ts` |
| Types | `types/walmart.ts` (re-exported via `@ext/core/types/index.ts`) |
| Docs / scripts | `docs/WALMART_RECORDING.md`, `docs/WALMART_AUTOMATION.md`, `scripts/debug-walmart-tab-pills.mjs` |

## Lib barrel

Core/UI-core import `@ext/domains/walmart/lib/index.ts` only (host + open-tab helpers).

## Tests

`tests/walmart/*`

## UI

Research section, tab pills: `ui/popup/domains/walmart/`
