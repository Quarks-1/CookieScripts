import {
  DOM_SUMMARY_DEBOUNCE_MS,
  WALMART_PROBE_VERSION,
} from "@ext/lib/walmart/constants.ts";
import { readCookieNames } from "@ext/lib/walmart/cookie-names.ts";
import { createSessionLimitState } from "@ext/lib/walmart/recording-limits.ts";
import {
  ensureWalmartResearchProbe,
  listenWalmartProbe,
  removeWalmartResearchProbe,
} from "@ext/lib/walmart/page-probe-bridge.ts";
import { detectAutoMarker } from "@ext/content/walmart/recorder/auto-markers.ts";
import { attachButtonStatePolling } from "@ext/content/walmart/recorder/button-polling.ts";
import { attachClickCapture } from "@ext/content/walmart/recorder/clicks.ts";
import { RecordingBatcher } from "@ext/content/walmart/recorder/batching.ts";
import {
  readStorageKeyNames,
  scanDomSummary,
} from "@ext/content/walmart/recorder/dom-summary.ts";
import { attachFormCapture } from "@ext/content/walmart/recorder/forms.ts";
import {
  attachNavigationCapture,
  navigationEvent,
} from "@ext/content/walmart/recorder/navigation.ts";
import { collectResourceTimingEvents } from "@ext/content/walmart/recorder/perf-backfill.ts";
import { probeDetailToEvent } from "@ext/content/walmart/recorder/probe-listener.ts";
import { capturePageSnapshot } from "@ext/content/walmart/recorder/snapshots.ts";
import { addNetworkBytes, estimateBytes } from "@ext/lib/walmart/recording-limits.ts";
import type { MarkerLabel, WalmartRecordingEvent } from "@ext/types/walmart.ts";

export type WalmartRecorderOptions = {
  skipSessionStart?: boolean;
  emitTabJoin?: boolean;
  tabId?: number;
};

export type WalmartRecorder = {
  stop: () => Promise<void>;
  mark: (label: MarkerLabel) => void;
};

function emitStorageAndCookies(enqueue: (event: WalmartRecordingEvent) => void): void {
  const keys = readStorageKeyNames();
  const ts = new Date().toISOString();
  enqueue({ kind: "storage_keys", ts, local: keys.local, session: keys.session });
  enqueue({ kind: "cookie_names", ts, names: readCookieNames() });
}

function emitAutoMarkerIfNeeded(
  url: string,
  enqueue: (event: WalmartRecordingEvent) => void,
  seen: Set<string>,
): void {
  const match = detectAutoMarker(url);
  if (!match) {
    return;
  }
  const key = `${match.label}:${match.detail ?? ""}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  enqueue({
    kind: "auto_marker",
    ts: new Date().toISOString(),
    label: match.label,
    url,
    detail: match.detail,
  });
}

export async function startWalmartRecorder(
  sessionId: string,
  batcher: RecordingBatcher,
  options: WalmartRecorderOptions = {},
): Promise<WalmartRecorder> {
  batcher.setSessionId(sessionId);
  let limitState = createSessionLimitState();
  const cleanups: Array<() => void> = [];
  let mutationTimer: ReturnType<typeof setTimeout> | null = null;
  const autoMarkersSeen = new Set<string>();
  const recordingStartedPerf = performance.now();
  const tabId = options.tabId;

  const stamp = (event: WalmartRecordingEvent): WalmartRecordingEvent => {
    if (tabId == null) {
      return event;
    }
    return { ...event, tabId } as WalmartRecordingEvent;
  };

  const enqueue = (event: WalmartRecordingEvent, byteDelta = 0) => {
    batcher.enqueue(stamp(event), byteDelta);
  };

  const captureSnapshot = (trigger: string) => {
    const snap = capturePageSnapshot(trigger, limitState);
    if (snap.result) {
      limitState = snap.limitState;
      const page =
        tabId != null ? { ...snap.result.page, tabId } : snap.result.page;
      batcher.enqueuePage(stamp(snap.result.event), page, snap.result.byteDelta);
    } else if (!limitState.allowPageHtml) {
      batcher.markTruncated();
    }
  };

  void ensureWalmartResearchProbe(document).then((probeReady) => {
    if (probeReady !== "ready") {
      return;
    }
    enqueue({
      kind: "probe_ready",
      ts: new Date().toISOString(),
      url: location.href,
      latencyMs: Math.round(performance.now() - recordingStartedPerf),
      probeVersion: WALMART_PROBE_VERSION,
    });
    for (const event of collectResourceTimingEvents(recordingStartedPerf)) {
      limitState = addNetworkBytes(limitState, estimateBytes(event));
      enqueue(event);
    }
    cleanups.push(
      listenWalmartProbe(document, (detail) => {
        const parsed = probeDetailToEvent(detail, limitState);
        limitState = parsed.limitState;
        if (parsed.event) {
          enqueue(parsed.event);
        }
      }),
    );
  });

  const onNavigate = (from: string, to: string) => {
    enqueue(navigationEvent(from, to));
    emitStorageAndCookies(enqueue);
    emitAutoMarkerIfNeeded(to, enqueue, autoMarkersSeen);
    captureSnapshot("navigation");
    scheduleDomSummary("navigation");
  };

  const scheduleDomSummary = (trigger: string) => {
    if (mutationTimer) {
      clearTimeout(mutationTimer);
    }
    mutationTimer = setTimeout(() => {
      const { buttons, landmarks, signals } = scanDomSummary();
      enqueue({
        kind: "dom_summary",
        ts: new Date().toISOString(),
        url: location.href,
        trigger,
        buttons,
        landmarks,
        signals,
      });
    }, DOM_SUMMARY_DEBOUNCE_MS);
  };

  cleanups.push(attachClickCapture(enqueue));
  cleanups.push(attachNavigationCapture(onNavigate));
  cleanups.push(attachButtonStatePolling(enqueue));
  cleanups.push(attachFormCapture(enqueue));

  const observer = new MutationObserver(() => scheduleDomSummary("mutation"));
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  cleanups.push(() => observer.disconnect());

  const onPageHide = () => {
    void batcher.flush();
  };
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void batcher.flush();
    }
  });
  cleanups.push(() => window.removeEventListener("pagehide", onPageHide));

  if (options.emitTabJoin && tabId != null) {
    enqueue({
      kind: "tab_join",
      ts: new Date().toISOString(),
      tabId,
      url: location.href,
    });
  }

  if (!options.skipSessionStart) {
    enqueue({
      kind: "session_start",
      ts: new Date().toISOString(),
      url: location.href,
    });
  }
  emitStorageAndCookies(enqueue);
  emitAutoMarkerIfNeeded(location.href, enqueue, autoMarkersSeen);
  captureSnapshot("session_start");

  return {
    mark(label: MarkerLabel) {
      enqueue({ kind: "marker", ts: new Date().toISOString(), label });
      emitStorageAndCookies(enqueue);
      captureSnapshot(label);
      void batcher.flush();
    },
    async stop() {
      for (const cleanup of cleanups) {
        cleanup();
      }
      if (mutationTimer) {
        clearTimeout(mutationTimer);
      }
      removeWalmartResearchProbe(document);
      await batcher.flush();
    },
  };
}
