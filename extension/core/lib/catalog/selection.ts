import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import type {
  CatalogCell,
  CatalogGroup,
  CatalogListingState,
  CatalogPickerRetailer,
  CatalogRow,
} from "@ext/core/types/index.ts";

export function isFirstPartyFullySelected(
  cell: CatalogCell,
  selected?: ReadonlySet<string>,
): boolean {
  if (!cell || cell.firstParty.length === 0) {
    return false;
  }
  if (selected) {
    return cell.firstParty.every((entry) => selected.has(entry.listing.sku));
  }
  return cell.firstParty.every((entry) => entry.selected);
}

export function isFirstPartyIndeterminate(
  cell: CatalogCell,
  selected?: ReadonlySet<string>,
): boolean {
  if (!cell || cell.firstParty.length === 0) {
    return false;
  }
  const selectedCount = selected
    ? cell.firstParty.filter((entry) => selected.has(entry.listing.sku)).length
    : cell.firstParty.filter((entry) => entry.selected).length;
  return selectedCount > 0 && selectedCount < cell.firstParty.length;
}

export function isFirstPartyPartiallySelected(cell: CatalogCell): boolean {
  if (!cell) {
    return false;
  }
  return cell.firstParty.some((entry) => entry.selected);
}

export function toggleFirstPartyCell(
  cell: CatalogCell,
  selected: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selected);
  if (!cell) {
    return next;
  }
  if (isFirstPartyFullySelected(cell, next)) {
    for (const entry of cell.firstParty) {
      next.delete(entry.listing.sku);
    }
    return next;
  }
  if (isFirstPartyIndeterminate(cell, next)) {
    for (const entry of cell.firstParty) {
      next.add(entry.listing.sku);
    }
    return next;
  }
  for (const entry of cell.firstParty) {
    next.add(entry.listing.sku);
  }
  return next;
}

export function toggleMarketplaceListing(
  sku: string,
  selected: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selected);
  if (next.has(sku)) {
    next.delete(sku);
  } else {
    next.add(sku);
  }
  return next;
}

function collectFirstPartySkus(rows: CatalogRow[], retailer: CatalogPickerRetailer): string[] {
  const skus: string[] = [];
  for (const row of rows) {
    const cell = row.cells[retailer];
    if (!cell) {
      continue;
    }
    for (const entry of cell.firstParty) {
      skus.push(entry.listing.sku);
    }
  }
  return skus;
}

export function selectAllFirstPartyInRows(
  rows: CatalogRow[],
  retailer: CatalogPickerRetailer,
  currentSkus: readonly string[],
  cap: number = MAX_SKUS_PER_LIST,
): { skus: string[]; skipped: number } {
  const next = new Set(currentSkus);
  let skipped = 0;

  for (const row of rows) {
    const cell = row.cells[retailer];
    if (!cell) {
      continue;
    }
    const unselected = cell.firstParty.filter((entry) => !next.has(entry.listing.sku));
    if (unselected.length === 0) {
      continue;
    }
    const remaining = cap - next.size;
    if (unselected.length > remaining) {
      skipped += unselected.length;
      continue;
    }
    for (const entry of unselected) {
      next.add(entry.listing.sku);
    }
  }

  return { skus: [...next], skipped };
}

export function clearFirstPartyInRows(
  rows: CatalogRow[],
  retailer: CatalogPickerRetailer,
  currentSkus: readonly string[],
): string[] {
  const remove = new Set(collectFirstPartySkus(rows, retailer));
  return currentSkus.filter((sku) => !remove.has(sku));
}

export function selectAllFirstPartyInGroup(
  group: CatalogGroup,
  retailer: CatalogPickerRetailer,
  currentSkus: readonly string[],
  cap: number = MAX_SKUS_PER_LIST,
): { skus: string[]; skipped: number } {
  const rows = [
    ...group.subgroups.flatMap((subgroup) => subgroup.rows),
    ...group.alsoContains.flatMap((subgroup) => subgroup.rows),
  ];
  return selectAllFirstPartyInRows(rows, retailer, currentSkus, cap);
}

export function clearFirstPartyInGroup(
  group: CatalogGroup,
  retailer: CatalogPickerRetailer,
  currentSkus: readonly string[],
): string[] {
  const rows = [
    ...group.subgroups.flatMap((subgroup) => subgroup.rows),
    ...group.alsoContains.flatMap((subgroup) => subgroup.rows),
  ];
  return clearFirstPartyInRows(rows, retailer, currentSkus);
}

export function canAddSku(currentCount: number, cap: number = MAX_SKUS_PER_LIST): boolean {
  return currentCount < cap;
}

export function listingWouldExceedCap(
  selected: ReadonlySet<string>,
  sku: string,
  cap: number = MAX_SKUS_PER_LIST,
): boolean {
  if (selected.has(sku)) {
    return false;
  }
  return selected.size >= cap;
}

export function firstPartyEntries(cell: CatalogCell): CatalogListingState[] {
  return cell?.firstParty ?? [];
}

export const CLEAR_ALL_CONFIRM_MESSAGE =
  "Clear all Target and Walmart SKUs? This includes ones you typed manually.";
