import {
  formatCatalogPrice,
  formatPackComposition,
} from "@ext/core/lib/catalog/index.ts";
import type { CatalogPickerRetailer, CatalogRow, CatalogSet } from "@ext/core/types/index.ts";

import { CatalogRetailerCell } from "./CatalogRetailerCell.tsx";

type CatalogProductRowProps = {
  row: CatalogRow;
  setIndex: Map<string, CatalogSet>;
  selectedSets: Record<CatalogPickerRetailer, ReadonlySet<string>>;
  disabled?: boolean;
  onToggleFirstParty: (retailer: CatalogPickerRetailer) => void;
  onToggleMarketplace: (retailer: CatalogPickerRetailer, sku: string) => void;
};

export function CatalogProductRow({
  row,
  setIndex,
  selectedSets,
  disabled,
  onToggleFirstParty,
  onToggleMarketplace,
}: CatalogProductRowProps) {
  const packComposition = formatPackComposition(row.product, setIndex);

  return (
    <tr className="border-t border-zinc-800/80">
      <td className="min-w-0 py-2 pr-3 align-top">
        <div className="font-medium text-zinc-100">{row.product.name}</div>
        {packComposition ? <div className="mt-0.5 text-xs text-zinc-500">{packComposition}</div> : null}
        <div className="mt-0.5 text-xs text-zinc-400">{formatCatalogPrice(row.product.msrp_cents)}</div>
      </td>
      <td className="catalog-retailer-col min-w-0 py-2 pr-3 align-top">
        <CatalogRetailerCell
          retailer="target"
          product={row.product}
          cell={row.cells.target}
          selected={selectedSets.target}
          disabled={disabled}
          onToggleFirstParty={() => onToggleFirstParty("target")}
          onToggleMarketplace={(sku) => onToggleMarketplace("target", sku)}
        />
      </td>
      <td className="catalog-retailer-col min-w-0 py-2 align-top">
        <CatalogRetailerCell
          retailer="walmart"
          product={row.product}
          cell={row.cells.walmart}
          selected={selectedSets.walmart}
          disabled={disabled}
          onToggleFirstParty={() => onToggleFirstParty("walmart")}
          onToggleMarketplace={(sku) => onToggleMarketplace("walmart", sku)}
        />
      </td>
    </tr>
  );
}
