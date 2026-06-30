import { idbGetAllByIndex, idbPut, STORE_EVENTS } from "@ext/domains/walmart/lib/idb/schema.ts";
import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export async function appendEvents(sessionId: string, events: WalmartRecordingEvent[]): Promise<void> {
  for (const event of events) {
    await idbPut(STORE_EVENTS, { sessionId, event });
  }
}

export async function listEvents(sessionId: string): Promise<WalmartRecordingEvent[]> {
  const rows = await idbGetAllByIndex<{ event: WalmartRecordingEvent }>(
    STORE_EVENTS,
    "sessionId",
    sessionId,
  );
  return rows.map((row) => row.event);
}

export async function hasSessionStartEvent(sessionId: string): Promise<boolean> {
  const events = await listEvents(sessionId);
  return events.some((event) => event.kind === "session_start");
}
