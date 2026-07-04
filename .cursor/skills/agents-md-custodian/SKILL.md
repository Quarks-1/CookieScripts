---
name: agents-md-custodian
description: >-
  Audit and update CookieScripts AGENTS.md layered docs for codebase drift.
  Use for scheduled doc custodian runs or when code changed without doc updates.
disable-model-invocation: true
---

# AGENTS.md custodian

Local symlink (optional): `ln -sf "$(git rev-parse --show-toplevel)/.cursor/skills/agents-md-custodian" ~/.cursor/skills/agents-md-custodian`

**Ownership:** This skill = procedure. [AGENTS.md](../../AGENTS.md) = content policy. `.cursor/rules/*.mdc` = always-on invariants (do not edit from custodian runs).

Schema: [reference.md](reference.md)

## Phase 0 — Scope

```bash
BASE=$(git log -1 --format=%H -- AGENTS.md 'extension/**/AGENTS.md' 'ui/**/AGENTS.md')
test -n "$BASE" && git rev-parse -q --verify "$BASE^{commit}" || exit 1
```

Code delta (exclude docs + custodian meta):

```bash
git diff "$BASE"..HEAD -- . \
  ':(exclude)**/AGENTS.md' \
  ':(exclude).cursor/skills/agents-md-custodian/**' \
  --stat
```

**Version-only noise:** if delta is only `package.json` / `manifest.json` and hunks are `"version"` field only → stop, no commit.

**Empty delta** (after version filter) → stop, no commit, no push.

Always read root [AGENTS.md](../../AGENTS.md) (Task routing + Manifest). Read only affected layer files. Deep-read only code files in the delta.

### Layer map

| Changed paths | AGENTS.md |
|---|---|
| `extension/core/**`, `tests/core/**` | `extension/core/AGENTS.md` |
| `extension/domains/discord/**`, `tests/discord/**` | `extension/domains/discord/AGENTS.md` |
| `extension/domains/target/**`, `tests/target/**` | `extension/domains/target/AGENTS.md` |
| `extension/domains/walmart/**`, `tests/walmart/**` | `extension/domains/walmart/AGENTS.md` |
| `ui/popup/**`, `ui/shared/**`, `ui/sidepanel/**` | `ui/popup/core/AGENTS.md` |
| `manifest.json`, `eslint.config.js`, `.github/**`, new top-level dirs | `AGENTS.md` (root) |

Classify via root Task routing table. **Never skip** co-updated layers — always re-audit; surgical fixes only.

### Layer coupling (minimum layers to audit)

| Touched path | Minimum layers |
|---|---|
| `extension/core/types/messages.ts` | core + affected domain(s) + ui-core if `UiToBackground` |
| `manifest.json` (non-version) | root only |
| `extension/domains/discord/**` | discord (+ root if new global invariant) |
| `extension/domains/target/**` | target |
| `extension/domains/walmart/**` | walmart |
| `ui/popup/**`, `ui/shared/**` | ui-core |

## Phase 1 — Drift checklist

Fix only when code delta implies drift:

- **Key files table** — new/moved modules (not full inventory)
- **Data flow mermaid** — new pipeline step only
- **Invariants** — behavioral rules not in `.mdc`
- **Task routing row** — edit paths changed
- **Root manifest table** — `manifest.json` changed (non-version)

**On-touch cleanup:** when editing a file, remove forbidden blocks reintroduced in that file (see [reference.md](reference.md)).

## Phase 2 — Prohibited

- Runtime message payload docs (use `messages.ts`)
- Test file inventories beyond `tests/{domain}/*`
- Verbatim `.mdc` duplication
- Sprint status, TODOs, selector payload tables
- Polish rewrites of unchanged sections
- Restating Documentation layers / Task routing (link to root)
- Edits to `.mdc`, `messages.ts`, or production code

## Phase 3 — Commit

1. `git fetch origin main && git rebase origin/main` — on conflict: abort, exit, no commit
2. Zero doc edits → no commit
3. Commit to `main` (no PR): `docs(agents): <specific drift> [skip ci]`
4. Body: layers touched + drift fixed
5. Do not run `npm test` / `npm lint` (docs-only)
6. Push to `origin main`

## Cloud automation

Dashboard prompt (after skill is on `main`):

```
/agents-md-custodian

Audit AGENTS.md drift since last layer-doc change, apply minimal fixes, commit directly to main. Commit message must include [skip ci]. No PR.
```

Pause old custodian automation during rollout. Enable new automation only after skill merge + smoke run.
