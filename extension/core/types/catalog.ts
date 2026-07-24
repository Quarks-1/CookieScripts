export type CatalogRetailer = "target" | "walmart";

export type CatalogPickerRetailer = CatalogRetailer;

export type CatalogProductType = string;

export type CatalogSet = {
  id: string;
  name: string;
  released_on?: string;
  kind?: "assorted";
};

export type CatalogListing = {
  retailer: CatalogRetailer;
  sku: string;
  marketplace?: boolean;
  price_cents?: number;
};

export type CatalogProductContent = {
  set_id: string;
  packs?: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  type: CatalogProductType;
  msrp_cents: number;
  contents: CatalogProductContent[];
  listings: CatalogListing[];
};

export type CatalogData = {
  schema_version: number;
  product_types: CatalogProductType[];
  sets: CatalogSet[];
  products: CatalogProduct[];
};

export type CatalogView = {
  groupBy: "set" | "type";
  retailerFilter: "all" | CatalogPickerRetailer;
  setIds?: string[];
  types?: CatalogProductType[];
  selectedOnly?: boolean;
  query?: string;
};

export type CatalogListingState = {
  listing: CatalogListing;
  selected: boolean;
};

export type CatalogCell = {
  firstParty: CatalogListingState[];
  marketplace: CatalogListingState[];
} | null;

export type CatalogRow = {
  product: CatalogProduct;
  cells: Record<CatalogPickerRetailer, CatalogCell>;
};

export type CatalogSubgroup = {
  id: string;
  label: string;
  rows: CatalogRow[];
};

export type CatalogGroup = {
  id: string;
  label: string;
  subgroups: CatalogSubgroup[];
  alsoContains: CatalogSubgroup[];
  totals: Record<CatalogPickerRetailer, { selected: number; available: number }>;
};

export type CatalogViewPersisted = {
  groupBy: CatalogView["groupBy"];
};
