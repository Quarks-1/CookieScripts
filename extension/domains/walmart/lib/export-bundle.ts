import { zipSync } from "fflate";

import { markerSlug } from "@ext/domains/walmart/lib/endpoint-index.ts";
import { listEndpoints } from "@ext/domains/walmart/lib/idb/endpoints-store.ts";
import { listEvents } from "@ext/domains/walmart/lib/idb/event-store.ts";
import { listPages } from "@ext/domains/walmart/lib/idb/pages-store.ts";
import { getSession } from "@ext/domains/walmart/lib/idb/session-store.ts";
import type { WalmartRecordingEvent, WalmartSessionMeta } from "@ext/domains/walmart/types/walmart.ts";

function isNetworkEvent(
  event: WalmartRecordingEvent,
): event is Extract<WalmartRecordingEvent, { kind: "network" | "websocket" }> {
  return event.kind === "network" || event.kind === "websocket";
}

function buildSummary(meta: WalmartSessionMeta, events: WalmartRecordingEvent[]) {
  const markers = events.filter((e) => e.kind === "marker");
  const autoMarkers = events.filter((e) => e.kind === "auto_marker");
  const urls = [...new Set(events.filter((e) => "url" in e).map((e) => (e as { url: string }).url))];
  const tabUrls = [
    ...new Set(
      events
        .filter((e) => e.kind === "tab_join" || e.kind === "session_start")
        .map((e) => (e as { url: string }).url),
    ),
  ];
  return {
    sessionId: meta.sessionId,
    startedAt: meta.startedAt,
    stoppedAt: meta.stoppedAt,
    dropDate: meta.dropDate,
    eventCount: events.length,
    tabCount: (meta.tabIds ?? (meta.tabId > 0 ? [meta.tabId] : [])).length,
    tabUrls,
    uniqueUrls: urls,
    markers: markers.map((m) => (m.kind === "marker" ? m.label : "")),
    autoMarkers: autoMarkers.map((m) => (m.kind === "auto_marker" ? m.label : "")),
    truncated: meta.truncated,
    droppedEvents: meta.droppedEvents,
    byteTotal: meta.byteTotal,
    extensionVersion: meta.extensionVersion,
    probeVersion: meta.probeVersion,
    failedAttachTabIds: meta.failedAttachTabIds,
  };
}

function pageFilename(index: number, trigger: string, tabId?: number): string {
  const slug = markerSlug(trigger) || "navigation";
  const prefix = tabId != null ? `t${tabId}-` : "";
  return `pages/${prefix}${String(index).padStart(3, "0")}-${slug}.json`;
}

export async function buildExportZip(sessionId: string): Promise<{
  zipBytes: Uint8Array;
  downloadFilename: string;
  meta: WalmartSessionMeta;
}> {
  const meta = await getSession(sessionId);
  if (!meta) {
    throw new Error("Session not found");
  }
  const events = await listEvents(sessionId);
  const pages = await listPages(sessionId);
  const endpoints = await listEndpoints(sessionId);

  const manifest = {
    sessionId: meta.sessionId,
    startedAt: meta.startedAt,
    stoppedAt: meta.stoppedAt,
    dropDate: meta.dropDate,
    truncated: meta.truncated,
    droppedEvents: meta.droppedEvents,
    byteTotal: meta.byteTotal,
    userAgent: meta.userAgent,
    startUrl: meta.url,
    extensionVersion: meta.extensionVersion,
    probeVersion: meta.probeVersion,
    tabIds: meta.tabIds ?? (meta.tabId > 0 ? [meta.tabId] : []),
    primaryTabId: meta.primaryTabId ?? (meta.tabId > 0 ? meta.tabId : null),
    tabCount: (meta.tabIds ?? (meta.tabId > 0 ? [meta.tabId] : [])).length,
    failedAttachTabIds: meta.failedAttachTabIds ?? [],
  };
  const summary = buildSummary(meta, events);
  const timeline = events.map((e) => JSON.stringify(e)).join("\n");
  const network = events.filter(isNetworkEvent).map((e) => JSON.stringify(e)).join("\n");

  const files: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  const base = `CookieScripts/walmart-live/${meta.dropDate}/session-${meta.sessionTime}`;
  files[`${base}/manifest.json`] = enc.encode(JSON.stringify(manifest, null, 2));
  files[`${base}/summary.json`] = enc.encode(JSON.stringify(summary, null, 2));
  files[`${base}/timeline.jsonl`] = enc.encode(timeline);
  files[`${base}/endpoints.json`] = enc.encode(JSON.stringify(endpoints, null, 2));
  files[`${base}/network.jsonl`] = enc.encode(network);

  let pageIndex = 1;
  for (const page of pages) {
    files[`${base}/${pageFilename(pageIndex, page.trigger, page.tabId)}`] = enc.encode(JSON.stringify(page, null, 2));
    pageIndex += 1;
  }

  const zipBytes = zipSync(files);
  const downloadFilename = `${base}.zip`;
  return { zipBytes, downloadFilename, meta };
}
