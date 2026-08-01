# Cursor Automation: Catalog SKU request

Use this document when configuring a Cursor Automation for GitHub issue-driven catalog additions.

## Automation settings

| Setting | Value |
|---------|-------|
| Name | Catalog SKU request |
| Trigger | **Webhook** |
| Repository | `Quarks-1/CookieScripts` |
| Tools | Pull request creation (enabled by default) |

After saving the automation, copy the webhook URL and generate an API key from the automation settings. Store them as GitHub Actions secrets (see [Webhook setup](#webhook-setup)).

## Webhook payload

The label workflow POSTs this JSON when a qualifying issue is opened or re-dispatched:

```json
{
  "event": "catalog_request",
  "repository": "Quarks-1/CookieScripts",
  "issue_number": 11,
  "issue_title": "[catalog-request] target SKU 95230445",
  "issue_url": "https://github.com/Quarks-1/CookieScripts/issues/11",
  "issue_body": "…full markdown body…"
}
```

## Agent prompt

Copy everything between the horizontal rules into the automation prompt.

---

## Goal

Add one missing Target or Walmart SKU to `extension/core/data/catalog.json` and open a **ready** (non-draft) pull request so CI and auto-merge can run.

## Trigger

Webhook POST with `event: "catalog_request"`. Use these payload fields:

| Field | Use |
|-------|-----|
| `issue_body` | Parse retailer and SKU |
| `issue_url` | Link in PR body and issue comment |
| `issue_number` | Issue thread for comments |

Parse **Retailer** (`target` or `walmart`) and **SKU** from markdown list items in `issue_body` (lines like `- **Retailer:**` and `- **SKU:**`).

## Stop without a PR

- SKU already exists in `catalog.json` → comment on the issue and stop.
- PDP unavailable or ambiguous → comment with findings and stop.
- **Marketplace / third-party seller PDP** → comment with findings and stop (see **Research PDP** below). Never add marketplace listings to `catalog.json`.
- `npm test`, `npm run lint`, or `npm run build` fail → fix or stop; never open a PR with failing checks.

## Workflow

1. **Duplicate check** — Search `extension/core/data/catalog.json` for the normalized `retailer:sku`. If found, comment on the issue and stop.

2. **Research PDP**
   - Target: `https://www.target.com/p/-/A-{sku}`
   - Walmart: `https://www.walmart.com/ip/{sku}`
   - **Marketplace check (required before editing catalog):**
     - **Target:** stop if the PDP is marketplace-only. Signals include **Sold & shipped by** a third party (not Target), **Target Plus** / **Target+** partner disclosures, or **ships from third party seller**. Same heuristics as `scripts/catalog-liveness/lib/classify-target.mjs` (`live_marketplace`). Example: TCIN `1011202516` (Shining Fates ETB sold by BlueProton) — valid product, but not a first-party listing.
     - **Walmart:** stop if sold by a marketplace seller (not Walmart.com).
     - Comment on the issue: the product may be real, but this SKU/link is marketplace-only; suggest a first-party Target/Walmart listing or a different retailer SKU. Do **not** open a PR.
   - Record: product name, `type` (from catalog `product_types`), `msrp_cents`, `set_id`, and `contents[].packs` when applicable.
   - New set → add `sets[]` entry. Unknown set → `assorted`.

3. **Edit catalog** — Update only `extension/core/data/catalog.json`:
   - Merge into an existing product when name, type, and set match; otherwise create a new product.
   - Product `id`: follow `slugify(name, type)` in `research/discord/scripts/author-catalog.mjs`.
   - Rules from `extension/core/lib/catalog/parse.ts`: **first-party listings only**, globally unique `retailer:sku`, valid `set_id`, `schema_version: 1`.
   - Never add `marketplace: true` listings — `parseCatalog` strips them; marketplace-only products are omitted from the shipped catalog (`tests/core/catalog-data.test.ts`).

4. **Verify** — Run `npm test`, `npm run lint`, and `npm run build`. All must pass.

5. **Branch** — `catalog/sku-{retailer}-{sku}` (example: `catalog/sku-target-95230445`).

6. **Pull request** — Open a **ready for review** PR (never a draft):
   - **Title:** `feat(catalog): add {retailer} SKU {sku} [skip ci]`
     - `[skip ci]` is required in the title (squash merge uses the PR title as the commit message).
   - **Body:** Link to `issue_url`, plus a short research summary (name, type, set, MSRP, PDP URL).
   - If the tooling creates a draft PR, mark it ready immediately (`gh pr ready` or equivalent) before finishing.

7. **Issue comment** — On the triggering issue, post the PR URL and one-line summary.

## Constraints

- Change only `extension/core/data/catalog.json` (new `sets[]` entries in the same file are OK).
- Do not open a draft PR — auto-merge runs only on ready PRs.
- Do not skip verification commands.

---

## Webhook setup

1. Create or edit the automation at [cursor.com/automations](https://cursor.com/automations) with trigger **Webhook** and repository `Quarks-1/CookieScripts`.
2. Save the automation, then copy the webhook URL and generate an auth header (Bearer `crsr_…`).
3. Add repo secrets: **Settings → Secrets → Actions →**
   - `CURSOR_CATALOG_WEBHOOK_URL` — full webhook URL
   - `CURSOR_CATALOG_WEBHOOK_KEY` — token only (without `Bearer ` prefix)
4. Delete or disable any superseded automations (e.g. PR label or issue-comment triggers) to avoid double-runs.
5. Merge `.github/workflows/catalog-sku-label.yml` to `main`.

### Smoke test

Replace placeholders and run locally after secrets are set:

```bash
curl -fsSL -X POST "$CURSOR_CATALOG_WEBHOOK_URL" \
  -H "Authorization: Bearer $CURSOR_CATALOG_WEBHOOK_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "catalog_request",
    "repository": "Quarks-1/CookieScripts",
    "issue_number": 11,
    "issue_title": "[catalog-request] target SKU 95230445",
    "issue_url": "https://github.com/Quarks-1/CookieScripts/issues/11",
    "issue_body": "## SKU request\n\n- **Retailer:** target\n- **SKU:** 95230445\n\n<!-- catalog-request-intake -->"
  }'
```

If you get `401` / `ERROR_NOT_LOGGED_IN`, regenerate the webhook API key in the automation UI and update `CURSOR_CATALOG_WEBHOOK_KEY`. This has been a known Cursor platform regression, not a repo bug.

## Related workflows

- Label + webhook trigger: `.github/workflows/catalog-sku-label.yml`
- Auto-merge after CI: `.github/workflows/catalog-sku-automerge.yml`
- Operator runbook: [../catalog-sku-request.md](../catalog-sku-request.md)
