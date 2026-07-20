import { idbGetAllByIndex, idbPut, STORE_PAGES } from "@ext/domains/samsclub/lib/idb/schema.ts";
import type { PageSnapshotRecord } from "@ext/domains/samsclub/types/samsclub.ts";

export async function appendPages(sessionId: string, pages: PageSnapshotRecord[]): Promise<void> {
  for (const page of pages) {
    await idbPut(STORE_PAGES, { ...page, sessionId });
  }
}

export async function listPages(sessionId: string): Promise<PageSnapshotRecord[]> {
  const rows = await idbGetAllByIndex<PageSnapshotRecord & { sessionId: string }>(
    STORE_PAGES,
    "sessionId",
    sessionId,
  );
  return rows.map(({ sessionId: _sid, ...page }) => page);
}
