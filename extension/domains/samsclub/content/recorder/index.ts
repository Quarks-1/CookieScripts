import {
  DOM_SUMMARY_DEBOUNCE_MS,
  SAMSCLUB_PROBE_VERSION,
} from "@ext/domains/samsclub/lib/constants.ts";
import { readCookieNames } from "@ext/domains/samsclub/lib/cookie-names.ts";
import { createSessionLimitState } from "@ext/domains/samsclub/lib/recording-limits.ts";
import {
  ensureSamsclubResearchProbe,
  listenSamsclubProbe,
  removeSamsclubResearchProbe,
} from "@ext/domains/samsclub/lib/page-probe-bridge.ts";
import { detectAutoMarker } from "@ext/domains/samsclub/content/recorder/auto-markers.ts";
import { attachButtonStatePolling } from "@ext/domains/samsclub/content/recorder/button-polling.ts";
import { attachClickCapture } from "@ext/domains/samsclub/content/recorder/clicks.ts";
import { RecordingBatcher } from "@ext/domains/samsclub/content/recorder/batching.ts";
import {
  readStorageKeyNames,
  scanDomSummary,
} from "@ext/domains/samsclub/content/recorder/dom-summary.ts";
import { attachFormCapture } from "@ext/domains/samsclub/content/recorder/forms.ts";
import {
  attachNavigationCapture,
  navigationEvent,
} from "@ext/domains/samsclub/content/recorder/navigation.ts";
import { collectResourceTimingEvents } from "@ext/domains/samsclub/content/recorder/perf-backfill.ts";
import { probeDetailToEvent } from "@ext/domains/samsclub/content/recorder/probe-listener.ts";
import { capturePageSnapshot } from "@ext/domains/samsclub/content/recorder/snapshots.ts";
import { addNetworkBytes, estimateBytes } from "@ext/domains/samsclub/lib/recording-limits.ts";
import type { MarkerLabel, SamsclubRecordingEvent } from "@ext/domains/samsclub/types/samsclub.ts";

export type SamsclubRecorderOptions = {
  skipSessionStart?: boolean;
  emitTabJoin?: boolean;
  tabId?: number;
};

export type SamsclubRecorder = {
  stop: () => Promise<void>;
  mark: (label: MarkerLabel) => void;
};

function emitStorageAndCookies(enqueue: (event: SamsclubRecordingEvent) => void): void {
  const keys = readStorageKeyNames();
  const ts = new Date().toISOString();
  enqueue({ kind: "storage_keys", ts, local: keys.local, session: keys.session });
  enqueue({ kind: "cookie_names", ts, names: readCookieNames() });
}

function emitAutoMarkerIfNeeded(
  url: string,
  enqueue: (event: SamsclubRecordingEvent) => void,
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

export async function startSamsclubRecorder(
  sessionId: string,
  batcher: RecordingBatcher,
  options: SamsclubRecorderOptions = {},
): Promise<SamsclubRecorder> {
  batcher.setSessionId(sessionId);
  let limitState = createSessionLimitState();
  const cleanups: Array<() => void> = [];
  let mutationTimer: ReturnType<typeof setTimeout> | null = null;
  const autoMarkersSeen = new Set<string>();
  const recordingStartedPerf = performance.now();
  const tabId = options.tabId;

  const stamp = (event: SamsclubRecordingEvent): SamsclubRecordingEvent => {
    if (tabId == null) {
      return event;
    }
    return { ...event, tabId } as SamsclubRecordingEvent;
  };

  const enqueue = (event: SamsclubRecordingEvent, byteDelta = 0) => {
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

  void ensureSamsclubResearchProbe(document).then((probeReady) => {
    if (probeReady !== "ready") {
      return;
    }
    enqueue({
      kind: "probe_ready",
      ts: new Date().toISOString(),
      url: location.href,
      latencyMs: Math.round(performance.now() - recordingStartedPerf),
      probeVersion: SAMSCLUB_PROBE_VERSION,
    });
    for (const event of collectResourceTimingEvents(recordingStartedPerf)) {
      limitState = addNetworkBytes(limitState, estimateBytes(event));
      enqueue(event);
    }
    cleanups.push(
      listenSamsclubProbe(document, (detail) => {
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
      removeSamsclubResearchProbe(document);
      await batcher.flush();
    },
  };
}
