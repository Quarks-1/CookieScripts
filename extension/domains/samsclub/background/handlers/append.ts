import {
  getSamsclubTabSession,
  readMetrics,
  writeMetrics,
} from "@ext/domains/samsclub/background/runtime-state.ts";
import { MAX_APPEND_CHUNK_BYTES } from "@ext/domains/samsclub/lib/constants.ts";
import { splitAppendPayload } from "@ext/domains/samsclub/lib/append-chunks.ts";
import { shouldCatalogNetworkEvent } from "@ext/domains/samsclub/lib/catalog-filter.ts";
import { upsertEndpoint } from "@ext/domains/samsclub/lib/endpoint-index.ts";
import { appendEvents } from "@ext/domains/samsclub/lib/idb/event-store.ts";
import { appendPages } from "@ext/domains/samsclub/lib/idb/pages-store.ts";
import { getSession, updateSession } from "@ext/domains/samsclub/lib/idb/session-store.ts";
import type { BackgroundResponse, SamsclubToBackground } from "@ext/core/types/index.ts";
import { endpointCatalogs } from "@ext/domains/samsclub/background/handlers/shared.ts";

async function applyAppendChunk(
  message: Extract<SamsclubToBackground, { type: "SAMSCLUB_RECORDING_APPEND" }>,
): Promise<void> {
  if (message.events.length > 0) {
    await appendEvents(message.sessionId, message.events);
    let catalog = endpointCatalogs.get(message.sessionId) ?? [];
    for (const event of message.events) {
      if (event.kind === "network" && shouldCatalogNetworkEvent(event)) {
        const catalogUrl = event.absoluteUrl ?? event.url;
        catalog = upsertEndpoint(
          catalog,
          event.method,
          catalogUrl,
          event.ts,
          event.requestBody,
        );
      }
    }
    endpointCatalogs.set(message.sessionId, catalog);
  }
  if (message.pages && message.pages.length > 0) {
    await appendPages(message.sessionId, message.pages);
  }

  const meta = await getSession(message.sessionId);
  if (meta) {
    if (message.byteDelta) {
      meta.byteTotal += message.byteDelta;
    }
    if (message.droppedEvents) {
      meta.droppedEvents += message.droppedEvents;
    }
    if (message.truncated) {
      meta.truncated = true;
    }
    await updateSession(meta);
    const metrics = await readMetrics();
    await writeMetrics({
      ...metrics,
      eventCount: metrics.eventCount + message.events.length,
      bytes: meta.byteTotal,
      dropDate: meta.dropDate,
      recordingActive: true,
      startedAt: meta.startedAt,
      sessionId: message.sessionId,
    });
  }
}

export async function handleSamsclubAppend(
  message: Extract<SamsclubToBackground, { type: "SAMSCLUB_RECORDING_APPEND" }>,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }
  const bound = getSamsclubTabSession(tabId);
  if (bound !== message.sessionId) {
    return { ok: false, error: "Session mismatch" };
  }

  const chunks = splitAppendPayload({
    sessionId: message.sessionId,
    events: message.events,
    pages: message.pages,
    byteDelta: message.byteDelta,
    droppedEvents: message.droppedEvents,
    truncated: message.truncated,
  });

  let droppedWholeBatch = false;
  for (const chunk of chunks) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify({ ...message, ...chunk })).length;
    if (payloadBytes > MAX_APPEND_CHUNK_BYTES) {
      const meta = await getSession(message.sessionId);
      if (meta) {
        meta.droppedEvents += chunk.events.length;
        meta.truncated = true;
        await updateSession(meta);
      }
      droppedWholeBatch = true;
      continue;
    }
    await applyAppendChunk({
      type: "SAMSCLUB_RECORDING_APPEND",
      sessionId: message.sessionId,
      events: chunk.events,
      pages: chunk.pages,
      byteDelta: chunk.byteDelta,
      droppedEvents: chunk.droppedEvents,
      truncated: chunk.truncated,
    });
  }

  return { ok: true, ack: true, dropped: droppedWholeBatch || undefined };
}
