/// <reference types="vite/client" />

declare module "@ext/core/data/catalog.json" {
  import type { CatalogData } from "@ext/core/types/catalog.ts";
  const value: CatalogData;
  export default value;
}
