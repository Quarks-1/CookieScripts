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

Copy the instructions below into the automation prompt.

---

You are adding a missing Target or Walmart SKU to the Pokémon TCG catalog in `extension/core/data/catalog.json`.

**Trigger:** A webhook POST where `event` is `catalog_request`. Parse **Retailer** and **SKU** from `issue_body` in the payload.

### Steps

1. Read `issue_body` from the webhook payload. Parse **Retailer** (`target` or `walmart`) and **SKU** from the markdown list items.
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
   - **Body:** Link to the issue (`issue_url` from payload), plus a short summary of research (name, type, set, MSRP).
9. Comment on the issue with the PR link.

### Quality bar

- Do not open a PR if tests, lint, or build fail.
- Do not change files other than `extension/core/data/catalog.json` unless a new set entry is required in the same file.
- If the PDP is unavailable or ambiguous, comment on the issue with findings and stop without opening a PR.

---

## Branch naming

`catalog/sku-{retailer}-{sku}` — example: `catalog/sku-target-95230445`

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
