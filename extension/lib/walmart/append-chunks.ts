import { MAX_APPEND_CHUNK_BYTES } from "@ext/lib/walmart/constants.ts";
import type { PageSnapshotRecord, WalmartRecordingEvent } from "@ext/types/walmart.ts";

export type AppendPayload = {
  sessionId: string;
  events: WalmartRecordingEvent[];
  pages?: PageSnapshotRecord[];
  byteDelta?: number;
  droppedEvents?: number;
  truncated?: boolean;
};

function estimatePayloadBytes(payload: AppendPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export function splitAppendPayload(payload: AppendPayload): AppendPayload[] {
  if (estimatePayloadBytes(payload) <= MAX_APPEND_CHUNK_BYTES) {
    return [payload];
  }

  const chunks: AppendPayload[] = [];
  const pages = payload.pages ?? [];
  const pageSnapshotEvents = payload.events.filter((event) => event.kind === "page_snapshot");
  const otherEvents = payload.events.filter((event) => event.kind !== "page_snapshot");

  for (const page of pages) {
    const snapEvent = pageSnapshotEvents.find(
      (event) => event.kind === "page_snapshot" && event.pageId === page.pageId,
    );
    chunks.push({
      sessionId: payload.sessionId,
      events: snapEvent ? [snapEvent] : [],
      pages: [page],
    });
  }

  let batch: WalmartRecordingEvent[] = [];
  let appliedMeta = chunks.length > 0;
  for (const event of otherEvents) {
    const candidate: AppendPayload = {
      sessionId: payload.sessionId,
      events: [...batch, event],
      byteDelta: !appliedMeta && batch.length === 0 ? (payload.byteDelta ?? 0) : 0,
      droppedEvents: !appliedMeta && batch.length === 0 ? (payload.droppedEvents ?? 0) : 0,
      truncated: !appliedMeta && batch.length === 0 ? (payload.truncated ?? false) : false,
    };
    if (estimatePayloadBytes(candidate) > MAX_APPEND_CHUNK_BYTES && batch.length > 0) {
      chunks.push({ sessionId: payload.sessionId, events: batch });
      appliedMeta = true;
      batch = [event];
      continue;
    }
    batch.push(event);
  }

  if (batch.length > 0) {
    chunks.push({
      sessionId: payload.sessionId,
      events: batch,
      byteDelta: !appliedMeta ? (payload.byteDelta ?? 0) : 0,
      droppedEvents: !appliedMeta ? (payload.droppedEvents ?? 0) : 0,
      truncated: !appliedMeta ? (payload.truncated ?? false) : false,
    });
  }

  return chunks.length > 0 ? chunks : [payload];
}
