# Cursor Automation: Catalog SKU request

Use this document when configuring a Cursor Automation for GitHub issue-driven catalog additions.

## Automation settings

| Setting | Value |
|---------|-------|
| Name | Catalog SKU request |
| Trigger | GitHub → **Issue comment** → issues in `Quarks-1/CookieScripts` |
| Comment filter | `@cursor catalog-request` (if the UI offers a keyword/body filter) |
| Repository | `Quarks-1/CookieScripts` |
| Tools | Pull request creation (enabled by default) |

**Why Issue comment, not Issue label?** The Cursor Automations UI often only exposes **Label change** for pull requests, not issues. Issue comment is available under GitHub → **Issue comment**.

**Why a comment at all?** Cursor ignores comments from `github-actions[bot]` / `GITHUB_TOKEN`. The label workflow posts `@cursor catalog-request` using a **PAT** stored as the repo secret `CATALOG_AGENT_TRIGGER_PAT` (fine-grained PAT with Issues read/write on this repo). Without that secret, label the issue via Actions and then comment `@cursor catalog-request` yourself to trigger the agent.

## Agent prompt

Copy the instructions below into the automation prompt.

---

You are adding a missing Target or Walmart SKU to the Pokémon TCG catalog in `extension/core/data/catalog.json`.

**Trigger:** A comment containing `@cursor catalog-request` on a GitHub issue. Parse **Retailer** and **SKU** from the **issue body** (not the comment).

### Steps

1. Read the **issue body** on the triggering thread. Parse **Retailer** (`target` or `walmart`) and **SKU** from the markdown list items.
2. If the SKU already exists in `extension/core/data/catalog.json`, comment on the issue explaining it is already listed and stop.
3. Research the product page:
   - Target: `https://www.target.com/p/-/A-{sku}`
   - Walmart: `https://www.walmart.com/ip/{sku}`
4. Determine: product name, `type` (from `product_types` in the catalog schema), `msrp_cents`, `set_id`, and `contents[].packs` if applicable. If the set is new, add a `sets[]` entry. If the set cannot be determined, use `assorted`.
5. Update `extension/core/data/catalog.json`:
   - Add the listing to an existing product when name/type/set match, otherwise create a new product.
   - Product `id` slugs must follow `slugify(name, type)` in `research/discord/scripts/author-catalog.mjs`.
   - Enforce rules in `extension/core/lib/catalog/parse.ts`: first-party listings only, globally unique `retailer:sku`, valid `set_id`, `schema_version: 1`.
6. Run `npm test`, `npm run lint`, and `npm run build`.
7. Commit on branch `catalog/sku-{retailer}-{sku}`.
8. Open a pull request:
   - **Title:** `feat(catalog): add {retailer} SKU {sku} [skip ci]` — `[skip ci]` must be in the title (squash merge uses the PR title as the commit message).
   - **Body:** Link to the issue, plus a short summary of research (name, type, set, MSRP).
9. Comment on the issue with the PR link.

### Quality bar

- Do not open a PR if tests, lint, or build fail.
- Do not change files other than `extension/core/data/catalog.json` unless a new set entry is required in the same file.
- If the PDP is unavailable or ambiguous, comment on the issue with findings and stop without opening a PR.

---

## Branch naming

`catalog/sku-{retailer}-{sku}` — example: `catalog/sku-target-95230445`

## PAT setup (automated trigger comment)

1. Create a fine-grained GitHub PAT for your account with **Issues** read/write on `Quarks-1/CookieScripts`.
2. Add repo secret: **Settings → Secrets → Actions →** `CATALOG_AGENT_TRIGGER_PAT`.
3. Merge `.github/workflows/catalog-sku-label.yml` to `main`.

The workflow applies `catalog-request` with `GITHUB_TOKEN`, then posts `@cursor catalog-request` with the PAT so Cursor sees a human-authored comment.

## Manual trigger (no PAT)

On a labeled catalog request issue, add a comment:

```text
@cursor catalog-request
```

## Related workflows

- Label + agent comment: `.github/workflows/catalog-sku-label.yml`
- Auto-merge after CI: `.github/workflows/catalog-sku-automerge.yml`
- Operator runbook: [../catalog-sku-request.md](../catalog-sku-request.md)
