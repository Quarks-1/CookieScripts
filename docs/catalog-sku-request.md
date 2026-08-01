# Catalog SKU request

End-to-end flow for requesting missing Target/Walmart SKUs from the extension side panel.

## Extension UI

1. Open the side panel → **Global** tab.
2. Under **Request catalog SKU**, pick Target or Walmart, enter the SKU, and click **Request catalog SKU**.
3. The extension validates the SKU, checks the live/cached catalog for duplicates, then opens a pre-filled GitHub issue in a new tab.
4. Submit the issue on GitHub.

## GitHub label workflow

[`.github/workflows/catalog-sku-label.yml`](../.github/workflows/catalog-sku-label.yml) runs on `issues.opened`. When the title starts with `[catalog-request]` and the body contains `<!-- catalog-request-intake -->`, it:

1. Ensures the `catalog-request` label exists and applies it.
2. POSTs the issue payload to the Cursor Automation webhook.

Non-collaborators cannot set labels via the `issues/new` URL; the label workflow is required.

If `CURSOR_CATALOG_WEBHOOK_URL` or `CURSOR_CATALOG_WEBHOOK_KEY` is missing, the workflow fails so you know the agent will not run.

## Cursor Automation

Configure manually at [cursor.com/automations](https://cursor.com/automations). Full prompt and settings: [cursor-automations/catalog-sku-request.md](./cursor-automations/catalog-sku-request.md).

**Prerequisites:**

- Cursor GitHub App connected to `Quarks-1/CookieScripts`
- Trigger: **Webhook** (not GitHub issue/PR events)
- Repo secrets `CURSOR_CATALOG_WEBHOOK_URL` and `CURSOR_CATALOG_WEBHOOK_KEY`

## Auto-merge

[`.github/workflows/catalog-sku-automerge.yml`](../.github/workflows/catalog-sku-automerge.yml) squash-merges PRs from branches matching `catalog/sku-*` after `test-and-build` passes and only `extension/core/data/catalog.json` changed.

**Branch protection:** ensure the Actions bot (`GITHUB_TOKEN`) can merge without a required human review, or automerge will fail.

## Release behavior

Agent PR titles must include `[skip ci]` so squash merges do not trigger the release workflow. Catalog updates still go live via `raw.githubusercontent.com` on the next catalog page open.

## One-time setup checklist

- [ ] Merge label + automerge workflows to `main` (push creates the `catalog-request` label automatically)
- [ ] Create Cursor Automation per [cursor-automations/catalog-sku-request.md](./cursor-automations/catalog-sku-request.md) with **Webhook** trigger
- [ ] Add repo secrets `CURSOR_CATALOG_WEBHOOK_URL` and `CURSOR_CATALOG_WEBHOOK_KEY`
- [ ] Delete or disable old Cursor automations (e.g. PR label or issue-comment variants)
- [ ] Delete repo secret `CATALOG_AGENT_TRIGGER_PAT` if it was added previously
- [ ] Confirm branch protection allows Actions merge for `catalog/sku-*` PRs
- [ ] Smoke-test webhook with `curl` (see automation doc) or re-run **Catalog SKU label** workflow with `issue_number` for a test issue

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Workflow fails on webhook step | Confirm both webhook secrets are set; regenerate API key in Cursor if POST returns 401 |
| Label applied but no agent run | Check Cursor Automations dashboard for a new run; verify webhook URL matches the saved automation |
| Agent opened PR for marketplace SKU | Close PR without merging; catalog ships first-party listings only. Re-copy the automation prompt from [cursor-automations/catalog-sku-request.md](./cursor-automations/catalog-sku-request.md) (marketplace PDPs must stop without a PR). |
| Retroactive issue | **Actions → Catalog SKU label → Run workflow** with `issue_number` |
