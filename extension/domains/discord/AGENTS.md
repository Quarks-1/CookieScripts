# Discord domain

Watches Discord channel tabs for product links and sends candidates to the background for allowlist filtering and tab opening.

## Key files

| Area | Path |
|---|---|
| Content entry | `content/entry.ts` |
| Session / observer | `content/session.ts`, `observers.ts`, `extract.ts` |
| DOM selectors | `content/selectors.ts` — **only** edit selectors here; bump `SELECTOR_VERSION` |
| Background handler | `background/handlers.ts` |
| Link pipeline (core) | `@ext/core/lib/process-links.ts`, `links.ts`, `validate.ts` |

## Messages (content → background)

`CHANNEL_ACTIVE`, `CHANNEL_INACTIVE`, `CANDIDATE_LINKS`, `ADD_ALLOWED_DOMAIN`, `IGNORE_DOMAIN`

## Tests

`tests/discord/*`

## UI

Side panel domains editor, detected links, link history: `ui/popup/domains/discord/`
