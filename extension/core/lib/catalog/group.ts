import type {
  CatalogCell,
  CatalogData,
  CatalogGroup,
  CatalogListing,
  CatalogListingState,
  CatalogPickerRetailer,
  CatalogProduct,
  CatalogRow,
  CatalogSet,
  CatalogSubgroup,
  CatalogView,
} from "@ext/core/types/index.ts";

type SetIndex = Map<string, CatalogSet>;

function buildSetIndex(catalog: CatalogData): SetIndex {
  return new Map(catalog.sets.map((set) => [set.id, set]));
}

function compareReleasedOnDesc(left?: string, right?: string): number {
  const l = left ?? "";
  const r = right ?? "";
  if (l === r) {
    return 0;
  }
  return l > r ? -1 : 1;
}

function compareProducts(left: CatalogProduct, right: CatalogProduct): number {
  if (left.msrp_cents !== right.msrp_cents) {
    return right.msrp_cents - left.msrp_cents;
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

export function resolvePrimarySetId(
  product: CatalogProduct,
  setIndex: SetIndex,
): string {
  if (product.contents.length === 0) {
    return "assorted";
  }

  let best = product.contents[0]!;
  for (const entry of product.contents.slice(1)) {
    const bestPacks = best.packs ?? 0;
    const entryPacks = entry.packs ?? 0;
    if (entryPacks > bestPacks) {
      best = entry;
      continue;
    }
    if (entryPacks < bestPacks) {
      continue;
    }
    const bestReleased = setIndex.get(best.set_id)?.released_on;
    const entryReleased = setIndex.get(entry.set_id)?.released_on;
    const releasedCompare = compareReleasedOnDesc(entryReleased, bestReleased);
    if (releasedCompare < 0) {
      best = entry;
    }
  }
  return best.set_id;
}

function buildListingState(
  listing: CatalogListing,
  selected: ReadonlySet<string>,
): CatalogListingState {
  return { listing, selected: selected.has(listing.sku) };
}

export function buildCatalogCell(
  product: CatalogProduct,
  retailer: CatalogPickerRetailer,
  selected: ReadonlySet<string>,
): CatalogCell {
  const retailerListings = product.listings.filter((listing) => listing.retailer === retailer);
  if (retailerListings.length === 0) {
    return null;
  }

  const firstParty: CatalogListingState[] = [];
  const marketplace: CatalogListingState[] = [];
  for (const listing of retailerListings) {
    const state = buildListingState(listing, selected);
    if (listing.marketplace) {
      marketplace.push(state);
    } else {
      firstParty.push(state);
    }
  }
  return { firstParty, marketplace };
}

export function buildCatalogRow(
  product: CatalogProduct,
  selected: Record<CatalogPickerRetailer, ReadonlySet<string>>,
): CatalogRow {
  return {
    product,
    cells: {
      target: buildCatalogCell(product, "target", selected.target),
      walmart: buildCatalogCell(product, "walmart", selected.walmart),
    },
  };
}

function rowMatchesQuery(row: CatalogRow, query: string, setIndex: SetIndex): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (row.product.name.toLowerCase().includes(needle)) {
    return true;
  }
  for (const listing of row.product.listings) {
    if (listing.sku.toLowerCase().includes(needle)) {
      return true;
    }
  }
  for (const content of row.product.contents) {
    const set = setIndex.get(content.set_id);
    if (set?.name.toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}

function rowMatchesRetailerFilter(row: CatalogRow, retailerFilter: CatalogView["retailerFilter"]): boolean {
  if (retailerFilter === "all") {
    return true;
  }
  return row.cells[retailerFilter] !== null;
}

function rowIsSelected(row: CatalogRow): boolean {
  for (const retailer of ["target", "walmart"] as const) {
    const cell = row.cells[retailer];
    if (!cell) {
      continue;
    }
    if (cell.firstParty.some((entry) => entry.selected) || cell.marketplace.some((entry) => entry.selected)) {
      return true;
    }
  }
  return false;
}

function rowMatchesView(
  row: CatalogRow,
  view: CatalogView,
  setIndex: SetIndex,
  _primarySetId: string,
): boolean {
  if (view.setIds?.length) {
    const matchesSet =
      row.product.contents.some((entry) => view.setIds!.includes(entry.set_id)) ||
      (row.product.contents.length === 0 && view.setIds.includes("assorted"));
    if (!matchesSet) {
      return false;
    }
  }
  if (view.types?.length && !view.types.includes(row.product.type)) {
    return false;
  }
  if (view.selectedOnly && !rowIsSelected(row)) {
    return false;
  }
  if (view.query && !rowMatchesQuery(row, view.query, setIndex)) {
    return false;
  }
  if (!rowMatchesRetailerFilter(row, view.retailerFilter)) {
    return false;
  }
  return true;
}

function countFirstPartyInRows(
  rows: CatalogRow[],
  retailer: CatalogPickerRetailer,
): { selected: number; available: number } {
  let selected = 0;
  let available = 0;
  for (const row of rows) {
    const cell = row.cells[retailer];
    if (!cell) {
      continue;
    }
    for (const entry of cell.firstParty) {
      available += 1;
      if (entry.selected) {
        selected += 1;
      }
    }
  }
  return { selected, available };
}

function computeGroupTotals(
  subgroups: CatalogSubgroup[],
  alsoContains: CatalogSubgroup[],
  retailer: CatalogPickerRetailer,
): { selected: number; available: number } {
  const rows = [
    ...subgroups.flatMap((subgroup) => subgroup.rows),
    ...alsoContains.flatMap((subgroup) => subgroup.rows),
  ];
  return countFirstPartyInRows(rows, retailer);
}

function subgroupLabelForType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sortRows(rows: CatalogRow[]): CatalogRow[] {
  return [...rows].sort((left, right) => compareProducts(left.product, right.product));
}

function buildSetModeGroups(
  catalog: CatalogData,
  view: CatalogView,
  selected: Record<CatalogPickerRetailer, ReadonlySet<string>>,
  setIndex: SetIndex,
): CatalogGroup[] {
  const primaryByProduct = new Map(
    catalog.products.map((product) => [product.id, resolvePrimarySetId(product, setIndex)]),
  );

  const rowsBySet = new Map<string, { primary: CatalogRow[]; also: CatalogRow[] }>();

  for (const product of catalog.products) {
    const row = buildCatalogRow(product, selected);
    const primarySetId = primaryByProduct.get(product.id)!;
    if (!rowMatchesView(row, view, setIndex, primarySetId)) {
      continue;
    }

    const bucket = rowsBySet.get(primarySetId) ?? { primary: [], also: [] };
    bucket.primary.push(row);
    rowsBySet.set(primarySetId, bucket);

    for (const content of product.contents) {
      if (content.set_id === primarySetId) {
        continue;
      }
      const alsoBucket = rowsBySet.get(content.set_id) ?? { primary: [], also: [] };
      alsoBucket.also.push(row);
      rowsBySet.set(content.set_id, alsoBucket);
    }
  }

  const setOrder = [...catalog.sets].sort((left, right) =>
    compareReleasedOnDesc(left.released_on, right.released_on),
  );

  const groups: CatalogGroup[] = [];
  for (const set of setOrder) {
    const bucket = rowsBySet.get(set.id);
    if (!bucket) {
      continue;
    }

    const typeBuckets = new Map<string, CatalogRow[]>();
    for (const row of bucket.primary) {
      const typeRows = typeBuckets.get(row.product.type) ?? [];
      typeRows.push(row);
      typeBuckets.set(row.product.type, typeRows);
    }

    const subgroups: CatalogSubgroup[] = [];
    for (const type of catalog.product_types) {
      const rows = typeBuckets.get(type);
      if (!rows?.length) {
        continue;
      }
      subgroups.push({
        id: `${set.id}:${type}`,
        label: subgroupLabelForType(type),
        rows: sortRows(rows),
      });
    }

    const alsoTypeBuckets = new Map<string, CatalogRow[]>();
    for (const row of bucket.also) {
      const typeRows = alsoTypeBuckets.get(row.product.type) ?? [];
      typeRows.push(row);
      alsoTypeBuckets.set(row.product.type, typeRows);
    }
    const alsoContains: CatalogSubgroup[] = [];
    for (const type of catalog.product_types) {
      const rows = alsoTypeBuckets.get(type);
      if (!rows?.length) {
        continue;
      }
      alsoContains.push({
        id: `${set.id}:also:${type}`,
        label: subgroupLabelForType(type),
        rows: sortRows(rows),
      });
    }

    if (!subgroups.length && !alsoContains.length) {
      continue;
    }

    groups.push({
      id: set.id,
      label: set.name,
      subgroups,
      alsoContains,
      totals: {
        target: computeGroupTotals(subgroups, alsoContains, "target"),
        walmart: computeGroupTotals(subgroups, alsoContains, "walmart"),
      },
    });
  }

  return groups;
}

function buildTypeModeGroups(
  catalog: CatalogData,
  view: CatalogView,
  selected: Record<CatalogPickerRetailer, ReadonlySet<string>>,
  setIndex: SetIndex,
): CatalogGroup[] {
  const rowsByType = new Map<string, CatalogRow[]>();

  for (const product of catalog.products) {
    const row = buildCatalogRow(product, selected);
    const primarySetId = resolvePrimarySetId(product, setIndex);
    if (!rowMatchesView(row, view, setIndex, primarySetId)) {
      continue;
    }
    const rows = rowsByType.get(product.type) ?? [];
    rows.push(row);
    rowsByType.set(product.type, rows);
  }

  const groups: CatalogGroup[] = [];
  for (const type of catalog.product_types) {
    const typeRows = rowsByType.get(type);
    if (!typeRows?.length) {
      continue;
    }

    const setBuckets = new Map<string, CatalogRow[]>();
    for (const row of typeRows) {
      const primarySetId = resolvePrimarySetId(row.product, setIndex);
      const rows = setBuckets.get(primarySetId) ?? [];
      rows.push(row);
      setBuckets.set(primarySetId, rows);
    }

    const setOrder = [...setBuckets.keys()].sort((leftId, rightId) => {
      const left = setIndex.get(leftId);
      const right = setIndex.get(rightId);
      return compareReleasedOnDesc(left?.released_on, right?.released_on);
    });

    const subgroups: CatalogSubgroup[] = [];
    for (const setId of setOrder) {
      const rows = setBuckets.get(setId);
      if (!rows?.length) {
        continue;
      }
      subgroups.push({
        id: `${type}:${setId}`,
        label: setIndex.get(setId)?.name ?? setId,
        rows: sortRows(rows),
      });
    }

    groups.push({
      id: type,
      label: subgroupLabelForType(type),
      subgroups,
      alsoContains: [],
      totals: {
        target: computeGroupTotals(subgroups, [], "target"),
        walmart: computeGroupTotals(subgroups, [], "walmart"),
      },
    });
  }

  return groups;
}

export function groupCatalog(
  catalog: CatalogData,
  view: CatalogView,
  selected: Record<CatalogPickerRetailer, ReadonlySet<string>>,
): CatalogGroup[] {
  const setIndex = buildSetIndex(catalog);
  if (view.groupBy === "type") {
    return buildTypeModeGroups(catalog, view, selected, setIndex);
  }
  return buildSetModeGroups(catalog, view, selected, setIndex);
}

export function formatCatalogPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPackComposition(
  product: CatalogProduct,
  setIndex: SetIndex,
): string | null {
  const parts: string[] = [];
  for (const content of product.contents) {
    if (typeof content.packs !== "number" || content.packs <= 0) {
      continue;
    }
    const setName = setIndex.get(content.set_id)?.name ?? content.set_id;
    parts.push(`${content.packs}\u00D7 ${setName}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildSetIndexFromCatalog(catalog: CatalogData): SetIndex {
  return buildSetIndex(catalog);
}
