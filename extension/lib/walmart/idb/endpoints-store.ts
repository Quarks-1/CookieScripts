import { idbGetAllByIndex, idbPut, STORE_ENDPOINTS } from "@ext/lib/walmart/idb/schema.ts";
import type { EndpointCatalogEntry } from "@ext/types/walmart.ts";

export async function saveEndpoints(sessionId: string, endpoints: EndpointCatalogEntry[]): Promise<void> {
  for (const endpoint of endpoints) {
    await idbPut(STORE_ENDPOINTS, { sessionId, endpoint });
  }
}

export async function listEndpoints(sessionId: string): Promise<EndpointCatalogEntry[]> {
  const rows = await idbGetAllByIndex<{ endpoint: EndpointCatalogEntry }>(
    STORE_ENDPOINTS,
    "sessionId",
    sessionId,
  );
  return rows.map((row) => row.endpoint);
}
