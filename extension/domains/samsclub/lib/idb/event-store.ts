import { idbGetAllByIndex, idbPut, STORE_EVENTS } from "@ext/domains/samsclub/lib/idb/schema.ts";
import type { SamsclubRecordingEvent } from "@ext/domains/samsclub/types/samsclub.ts";

export async function appendEvents(sessionId: string, events: SamsclubRecordingEvent[]): Promise<void> {
  for (const event of events) {
    await idbPut(STORE_EVENTS, { sessionId, event });
  }
}

export async function listEvents(sessionId: string): Promise<SamsclubRecordingEvent[]> {
  const rows = await idbGetAllByIndex<{ event: SamsclubRecordingEvent }>(
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
