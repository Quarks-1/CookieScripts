import {
  formatCatalogPrice,
  isFirstPartyFullySelected,
  isFirstPartyIndeterminate,
  listingWouldExceedCap,
} from "@ext/core/lib/catalog/index.ts";
import { buildTargetProductUrlFromSku } from "@ext/domains/target/lib/index.ts";
import { buildWalmartProductUrlFromSku } from "@ext/domains/walmart/lib/index.ts";
import type { CatalogCell, CatalogListingState, CatalogPickerRetailer, CatalogProduct } from "@ext/core/types/index.ts";

type MarketplaceListingsProps = {
  retailerLabel: string;
  productName: string;
  listings: CatalogListingState[];
  selected: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (sku: string) => void;
};

export function MarketplaceListings({
  retailerLabel,
  productName,
  listings,
  selected,
  disabled,
  onToggle,
}: MarketplaceListingsProps) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1 space-y-1">
      {listings.map((entry) => {
        const atCap = listingWouldExceedCap(selected, entry.listing.sku);
        return (
          <li key={entry.listing.sku} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={entry.selected}
              disabled={disabled || (atCap && !entry.selected)}
              onChange={() => onToggle(entry.listing.sku)}
              aria-label={`${retailerLabel} ${productName} marketplace ${entry.listing.sku}`}
            />
            <a
              href={buildProductUrl(entry.listing.retailer, entry.listing.sku)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sky-300 hover:underline"
            >
              {entry.listing.sku}
            </a>
            {entry.listing.price_cents ? (
              <span className="text-zinc-500">{formatCatalogPrice(entry.listing.price_cents)}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type CatalogRetailerCellProps = {
  retailer: CatalogPickerRetailer;
  product: CatalogProduct;
  cell: CatalogCell;
  selected: ReadonlySet<string>;
  disabled?: boolean;
  onToggleFirstParty: () => void;
  onToggleMarketplace: (sku: string) => void;
};

function buildProductUrl(retailer: CatalogPickerRetailer, sku: string): string {
  return retailer === "target"
    ? buildTargetProductUrlFromSku(sku)
    : buildWalmartProductUrlFromSku(sku);
}

export function CatalogRetailerCell({
  retailer,
  product,
  cell,
  selected,
  disabled,
  onToggleFirstParty,
  onToggleMarketplace,
}: CatalogRetailerCellProps) {
  if (!cell) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  const retailerLabel = retailer === "target" ? "Target" : "Walmart";
  const hasFirstParty = cell.firstParty.length > 0;
  const checked = isFirstPartyFullySelected(cell, selected);
  const indeterminate = isFirstPartyIndeterminate(cell, selected);
  const primary = cell.firstParty[0];
  const atCap = hasFirstParty && listingWouldExceedCap(selected, primary?.listing.sku ?? "") && !checked;

  return (
    <div>
      {hasFirstParty ? (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            ref={(input) => {
              if (input) {
                input.indeterminate = indeterminate;
              }
            }}
            disabled={disabled || (atCap && !checked && !indeterminate)}
            onChange={onToggleFirstParty}
            aria-label={`${retailerLabel} ${product.name}`}
          />
          {primary ? (
            <a
              href={buildProductUrl(retailer, primary.listing.sku)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-sky-300 hover:underline"
            >
              {primary.listing.sku}
            </a>
          ) : null}
        </div>
      ) : null}
      {cell.marketplace.length > 0 ? (
        <>
          <span className="mt-1 inline-block rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            Marketplace
          </span>
          <MarketplaceListings
            retailerLabel={retailerLabel}
            productName={product.name}
            listings={cell.marketplace}
            selected={selected}
            disabled={disabled}
            onToggle={onToggleMarketplace}
          />
        </>
      ) : null}
    </div>
  );
}
