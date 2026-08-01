# Catalog SKU request

End-to-end flow for requesting missing Target/Walmart SKUs from the extension side panel.

## Extension UI

1. Open the side panel → **Global** tab.
2. Under **Request catalog SKU**, pick Target or Walmart, enter the SKU, and click **Request catalog SKU**.
3. The extension validates the SKU, checks the live/cached catalog for duplicates, then opens a pre-filled GitHub issue in a new tab.
4. Submit the issue on GitHub.

## GitHub label workflow

[`.github/workflows/catalog-sku-label.yml`](../.github/workflows/catalog-sku-label.yml) runs on `issues.opened`. When the title starts with `[catalog-request]` and the body contains `<!-- catalog-request-intake -->`, it ensures the `catalog-request` label exists and applies it.

Non-collaborators cannot set labels via the `issues/new` URL; this workflow is required for the label.

When repo secret `CATALOG_AGENT_TRIGGER_PAT` is set, the workflow also comments `@cursor catalog-request` on the issue (Cursor ignores `GITHUB_TOKEN` bot comments).

## Cursor Automation

Configure manually at [cursor.com/automations](https://cursor.com/automations). Full prompt and settings: [cursor-automations/catalog-sku-request.md](./cursor-automations/catalog-sku-request.md).

**Prerequisites:**

- Cursor GitHub App connected to `Quarks-1/CookieScripts`
- Trigger: **Issue comment** on issues in this repo (filter `@cursor catalog-request` if available)
- Repo secret `CATALOG_AGENT_TRIGGER_PAT` for fully automated runs, **or** comment `@cursor catalog-request` on the issue yourself after submit

## Auto-merge

[`.github/workflows/catalog-sku-automerge.yml`](../.github/workflows/catalog-sku-automerge.yml) squash-merges PRs from branches matching `catalog/sku-*` after `CI / test-and-build` passes and only `extension/core/data/catalog.json` changed.

**Branch protection:** ensure the Actions bot (`GITHUB_TOKEN`) can merge without a required human review, or automerge will fail.

## Release behavior

Agent PR titles must include `[skip ci]` so squash merges do not trigger the release workflow. Catalog updates still go live via `raw.githubusercontent.com` on the next catalog page open.

## One-time setup checklist

- [ ] Merge label + automerge workflows to `main` (push creates the `catalog-request` label automatically)
- [ ] Add repo secret `CATALOG_AGENT_TRIGGER_PAT` (fine-grained PAT, Issues write on this repo) for automated `@cursor catalog-request` comments
- [ ] Create Cursor Automation per [cursor-automations/catalog-sku-request.md](./cursor-automations/catalog-sku-request.md) (**Issue comment**, not PR label)
- [ ] For issues opened before deploy: run **Catalog SKU label** workflow with `issue_number`, or comment `@cursor catalog-request` on the issue
- [ ] Confirm branch protection allows Actions merge for `catalog/sku-*` PRs
