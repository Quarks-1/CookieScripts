import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { sendToBackground } from "@ext/core/lib/messages.ts";
import type {
  BackgroundResponse,
  SamsclubLastExport,
  SamsclubMarkedLabelsState,
  SamsclubRecordingMetrics,
} from "@ext/core/types/index.ts";
import type { MarkerLabel } from "@ext/domains/samsclub/types/samsclub.ts";

const DEFAULT_METRICS: SamsclubRecordingMetrics = {
  sessionId: null,
  eventCount: 0,
  bytes: 0,
  dropDate: null,
  recordingActive: false,
  startedAt: null,
};

async function readMarkedLabels(sessionId: string | null): Promise<MarkerLabel[]> {
  if (!sessionId) {
    return [];
  }
  const result = await chrome.storage.session.get(STORAGE_KEYS.samsclubMarkedLabels);
  const stored = result[STORAGE_KEYS.samsclubMarkedLabels] as SamsclubMarkedLabelsState | undefined;
  if (!stored || stored.sessionId !== sessionId) {
    return [];
  }
  return stored.labels;
}

async function writeMarkedLabels(sessionId: string, labels: MarkerLabel[]): Promise<void> {
  await chrome.storage.session.set({
    [STORAGE_KEYS.samsclubMarkedLabels]: { sessionId, labels } satisfies SamsclubMarkedLabelsState,
  });
}

async function clearMarkedLabelsStorage(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEYS.samsclubMarkedLabels);
}

export function useSamsclubRecording(
  enabled: boolean,
  recordingActive: boolean,
  anySamsclubTabOpen: boolean,
) {
  const [metrics, setMetrics] = useState<SamsclubRecordingMetrics>(DEFAULT_METRICS);
  const [markedLabels, setMarkedLabels] = useState<MarkerLabel[]>([]);
  const [markingLabel, setMarkingLabel] = useState<MarkerLabel | null>(null);
  const [lastExport, setLastExport] = useState<SamsclubLastExport | null>(null);
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    try {
      return localStorage.getItem("cookiescripts:samsclubDisclaimerAccepted") === "1";
    } catch {
      return false;
    }
  });

  const refreshFromStorage = useCallback(async () => {
    const [metricsResult, exportResult] = await Promise.all([
      chrome.storage.session.get(STORAGE_KEYS.samsclubMetrics),
      chrome.storage.session.get(STORAGE_KEYS.samsclubLastExport),
    ]);
    const nextMetrics =
      (metricsResult[STORAGE_KEYS.samsclubMetrics] as SamsclubRecordingMetrics) ?? DEFAULT_METRICS;
    setMetrics(nextMetrics);
    setLastExport((exportResult[STORAGE_KEYS.samsclubLastExport] as SamsclubLastExport) ?? null);
    if (nextMetrics.recordingActive && nextMetrics.sessionId) {
      setMarkedLabels(await readMarkedLabels(nextMetrics.sessionId));
    } else {
      setMarkedLabels([]);
    }
  }, []);

  useEffect(() => {
    void refreshFromStorage();
  }, [refreshFromStorage, recordingActive, anySamsclubTabOpen]);

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "session") {
        return;
      }
      if (
        changes[STORAGE_KEYS.samsclubMetrics] ||
        changes[STORAGE_KEYS.samsclubLastExport] ||
        changes[STORAGE_KEYS.samsclubMarkedLabels]
      ) {
        void refreshFromStorage();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refreshFromStorage]);

  const runAction = useCallback(
    async (
      action: "start" | "stop" | "mark" | "clear" | "export",
      label?: MarkerLabel,
    ): Promise<BackgroundResponse> => {
      setActing(true);
      setActionError(null);
      if (action === "stop" || action === "export") {
        setExporting(true);
      }
      if (action === "start") {
        setMarkedLabels([]);
        void clearMarkedLabelsStorage();
        setMetrics((prev) => ({
          ...prev,
          recordingActive: true,
          startedAt: new Date().toISOString(),
          eventCount: 0,
          bytes: 0,
        }));
      } else if (action === "stop") {
        setMetrics((prev) => ({ ...prev, recordingActive: false }));
      }
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SAMSCLUB_RECORDING",
          action,
          label,
        });
        if ("ok" in response && response.ok === false) {
          setActionError(response.error);
          if (action === "start") {
            setMetrics((prev) => ({ ...prev, recordingActive: false, startedAt: null }));
          } else if (action === "stop") {
            setMetrics((prev) => ({ ...prev, recordingActive: true }));
          }
        } else if (action === "start" && "ok" in response && response.ok) {
          setActionError(null);
        } else if (action === "stop" || action === "clear") {
          setMarkedLabels([]);
          await clearMarkedLabelsStorage();
        }
        await refreshFromStorage();
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed";
        setActionError(message);
        if (action === "start") {
          setMetrics((prev) => ({ ...prev, recordingActive: false, startedAt: null }));
        } else if (action === "stop") {
          setMetrics((prev) => ({ ...prev, recordingActive: true }));
        }
        return { ok: false, error: message };
      } finally {
        setActing(false);
        setExporting(false);
      }
    },
    [refreshFromStorage],
  );

  const markStage = useCallback(
    async (label: MarkerLabel): Promise<void> => {
      const sessionId = metrics.sessionId;
      if (!metrics.recordingActive || !sessionId || markedLabels.includes(label)) {
        return;
      }

      setMarkingLabel(label);
      setActionError(null);
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SAMSCLUB_RECORDING",
          action: "mark",
          label,
        });
        if ("ok" in response && response.ok === false) {
          setActionError(response.error);
          return;
        }
        setMarkedLabels((prev) => {
          if (prev.includes(label)) {
            return prev;
          }
          const next = [...prev, label];
          void writeMarkedLabels(sessionId, next);
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Marker failed";
        setActionError(message);
      } finally {
        setMarkingLabel(null);
      }
    },
    [markedLabels, metrics.recordingActive, metrics.sessionId],
  );

  const acceptDisclaimer = useCallback(() => {
    try {
      localStorage.setItem("cookiescripts:samsclubDisclaimerAccepted", "1");
    } catch {
      // ignore
    }
    setDisclaimerAccepted(true);
  }, []);

  const showInFolder = useCallback(async () => {
    if (lastExport?.downloadId == null) {
      return;
    }
    await chrome.downloads.show(lastExport.downloadId);
  }, [lastExport]);

  const copyPath = useCallback(async () => {
    if (!lastExport?.filename) {
      return;
    }
    await navigator.clipboard.writeText(lastExport.filename);
  }, [lastExport]);

  return {
    metrics,
    markedLabels,
    markingLabel,
    lastExport,
    acting,
    exporting,
    actionError,
    disclaimerAccepted,
    disabled: !enabled || (!anySamsclubTabOpen && !recordingActive),
    acceptDisclaimer,
    runAction,
    markStage,
    showInFolder,
    copyPath,
  };
}
