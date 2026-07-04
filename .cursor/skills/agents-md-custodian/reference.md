# AGENTS.md schema reference

Link to live policy: [AGENTS.md](../../AGENTS.md) § Documentation layers, Task routing, Never in AGENTS.md.

Do **not** copy routing tables, lib maps, or layer prose from production files into this reference.

## Forbidden blocks

- Runtime message name inventories (use `messages.ts` + `runtime-messages.mdc`)
- Test highlight tables listing individual `.test.ts` files
- Payload field docs, selector tables, sprint status, TODOs
- Verbatim duplication of `.cursor/rules/*.mdc` content

## Required section order

### Root (`AGENTS.md`)

1. Capability summary
2. Start here / Agent workflow
3. Documentation layers (diagram + table)
4. Task routing
5. Repository layout, Path aliases, Import rules
6. Architecture, Manifest & permissions
7. Dev & test, Critical invariants, CI & release

### Core / UI-core / Domain

1. One-line purpose
2. Key files (trimmed table)
3. Data flow (mermaid, optional)
4. Domain-specific subsections (session modules, handler modules, etc.)
5. Messages (pointer only — see triad below)
6. Invariants
7. Link to root AGENTS.md
8. Tests (`tests/{domain}/*` one-liner)
9. UI / Deep docs (optional)

## Messages triad (one sentence per layer file)

- `messages.ts` = what exists
- `runtime-messages.mdc` = how to add/change
- Layer `AGENTS.md` = where to work + invariants (never enumerate payloads)

## Gotchas to preserve (not inventories)

| Layer | Keep as invariant bullet |
|---|---|
| Target | `RETAILER_SET_REFRESH_INTERVAL` ≠ `SET_RETAILER_REFRESH_INTERVAL` |
| Walmart | `WALMART_RECORDING` action union in `types/walmart.ts` |
| UI-core | Walmart queue settings via `getExtensionSettings` / `saveExtensionSettings`, not `UiToBackground` |
| Core | `SCAN_DETECTED_DOMAINS` bypasses `handleMessage` |
| Discord | Optional `message_text` on `CANDIDATE_LINKS` for keyword gate |

## Soft line budgets

| Layer | Target |
|---|---|
| Root | ≤ 200 lines |
| Core / UI-core / Domain | ≤ 120 lines each |

Trim duplication before deleting essential routing. Mermaid diagrams and concern-grouped lib maps are allowed.

## Skeleton: domain layer

```markdown
# {Domain} domain

<!-- one-line purpose -->

## Key files
| Area | Path |
|---|---|
<!-- trimmed rows only -->

## Data flow
<!-- mermaid only if pipeline steps exist -->

## Messages
Source of truth: `types/messages.ts`. Handlers: `background/handlers*`. How to add: `runtime-messages.mdc`.

## Invariants
<!-- behavioral rules not in .mdc -->

Global invariants: [AGENTS.md](...)

## Tests
`tests/{domain}/*`

## UI
<!-- side panel paths -->
```

## Good vs bad edits

**Bad — test inventory:**

```markdown
| Handler routing | handlers-discord.test.ts, handlers-target.test.ts, ... |
```

**Good:**

```markdown
`tests/core/*` — handler routing (`handlers-*.test.ts`)
```

**Bad — message inventory:**

```markdown
- `RetailerToBackground`: `RETAILER_AUTO_STATUS`, `RETAILER_GET_AUTO_CONFIG`, ...
```

**Good:**

```markdown
Source of truth: `types/messages.ts`. How to add/change: `runtime-messages.mdc`.
Content `RETAILER_SET_REFRESH_INTERVAL` and UI `SET_RETAILER_REFRESH_INTERVAL` are distinct messages.
```
