import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import type { CatalogView } from "@ext/core/types/index.ts";

import { SegmentedToggle } from "./SegmentedToggle.tsx";

type CatalogHeaderProps = {
  view: CatalogView;
  targetCount: number;
  walmartCount: number;
  skuOpenModeEnabled: boolean;
  saving: boolean;
  saveError: string | null;
  overflowMessage: string | null;
  onGroupByChange: (groupBy: CatalogView["groupBy"]) => void;
  onRetailerFilterChange: (filter: CatalogView["retailerFilter"]) => void;
  onSkuOpenModeChange: (enabled: boolean) => void;
  onClearAll: () => void;
};

export function CatalogHeader({
  view,
  targetCount,
  walmartCount,
  skuOpenModeEnabled,
  saving,
  saveError,
  overflowMessage,
  onGroupByChange,
  onRetailerFilterChange,
  onSkuOpenModeChange,
  onClearAll,
}: CatalogHeaderProps) {
  async function handleSkuOpenModeChange(next: boolean) {
    const settings = await getExtensionSettings();
    await saveExtensionSettings({ ...settings, sku_open_mode_enabled: next });
    onSkuOpenModeChange(next);
  }

  return (
    <header className="space-y-3 border-b border-zinc-800 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">SKU catalog</h1>
        <button
          type="button"
          disabled={saving}
          onClick={onClearAll}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SegmentedToggle
          id="catalog-group-by"
          label="Group by:"
          value={view.groupBy}
          disabled={saving}
          options={[
            { value: "set", label: "Set" },
            { value: "type", label: "Type" },
          ]}
          onChange={onGroupByChange}
        />
        <SegmentedToggle
          id="catalog-retailer-filter"
          label="Show:"
          value={view.retailerFilter}
          disabled={saving}
          options={[
            { value: "all", label: "All" },
            { value: "target", label: "Target" },
            { value: "walmart", label: "Walmart" },
          ]}
          onChange={onRetailerFilterChange}
        />
      </div>

      <EnableSlider
        id="catalog-sku-open-mode"
        label="SKU open mode"
        checked={skuOpenModeEnabled}
        disabled={saving}
        onChange={(next) => void handleSkuOpenModeChange(next)}
      />

      <div className="flex flex-wrap gap-4 text-sm text-zinc-300" role="status">
        <span>
          Target {targetCount} / {MAX_SKUS_PER_LIST}
        </span>
        <span>
          Walmart {walmartCount} / {MAX_SKUS_PER_LIST}
        </span>
      </div>

      {saving && <p className="text-xs text-zinc-500">Saving…</p>}
      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
      {overflowMessage && (
        <p role="status" aria-live="polite" className="text-xs text-amber-300">
          {overflowMessage}
        </p>
      )}
    </header>
  );
}
