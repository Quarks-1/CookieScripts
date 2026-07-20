import { useEffect, useState } from "react";

import type { SamsclubLastExport, SamsclubOpenTabSummary } from "@ext/core/types/index.ts";
import type { MarkerLabel } from "@ext/domains/samsclub/types/samsclub.ts";

import { SamsclubTabPills } from "./SamsclubTabPills.tsx";

const MARKERS: MarkerLabel[] = [
  "Blocked",
  "Search",
  "Product page",
  "Add to cart",
  "Cart page",
  "Pre-checkout",
  "Post-checkout",
];

interface SamsclubResearchSectionProps {
  openTabs: SamsclubOpenTabSummary[];
  recordingActive: boolean;
  recordingTabCount: number;
  eventCount: number;
  bytes: number;
  startedAt: string | null;
  lastExport: SamsclubLastExport | null;
  disclaimerAccepted: boolean;
  disabled: boolean;
  acting: boolean;
  exporting: boolean;
  actionError: string | null;
  markedLabels: MarkerLabel[];
  markingLabel: MarkerLabel | null;
  onAcceptDisclaimer: () => void;
  onStart: () => void;
  onStop: () => void;
  onMark: (label: MarkerLabel) => void;
  onReExport: () => void;
  onClear: () => void;
  onShowInFolder: () => void;
  onCopyPath: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) {
    return "0:00";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function folderLabel(os: string): string {
  if (os === "mac") {
    return "Show in Finder";
  }
  if (os === "win") {
    return "Show in File Explorer";
  }
  return "Show in Files";
}

export function SamsclubResearchSection({
  openTabs,
  recordingActive,
  recordingTabCount,
  eventCount,
  bytes,
  startedAt,
  lastExport,
  disclaimerAccepted,
  disabled,
  acting,
  exporting,
  actionError,
  markedLabels,
  markingLabel,
  onAcceptDisclaimer,
  onStart,
  onStop,
  onMark,
  onReExport,
  onClear,
  onShowInFolder,
  onCopyPath,
}: SamsclubResearchSectionProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt));
  const [os, setOs] = useState("mac");

  useEffect(() => {
    void chrome.runtime.getPlatformInfo().then((info) => setOs(info.os));
  }, []);

  useEffect(() => {
    if (!recordingActive) {
      setElapsed(formatElapsed(startedAt));
      return;
    }
    const timer = window.setInterval(() => setElapsed(formatElapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [recordingActive, startedAt]);

  const controlsDisabled = disabled || acting || exporting;

  return (
    <section aria-labelledby="samsclub-research-heading">
      <h2 id="samsclub-research-heading" className="text-sm font-medium text-zinc-400">
        Sam&apos;s Club Research
      </h2>
      <SamsclubTabPills openTabs={openTabs} />

      {!disclaimerAccepted && (
        <div className="mt-3 rounded border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-100">
          <p>
            Exports may contain account-related data from your Sam&apos;s Club session. Store ZIPs
            securely.
          </p>
          <button
            type="button"
            className="mt-2 rounded border border-amber-600 px-2 py-1"
            onClick={onAcceptDisclaimer}
          >
            I understand
          </button>
        </div>
      )}

      <p className="mt-2 text-xs text-zinc-400" role="status" aria-live="polite">
        {recordingActive
          ? recordingTabCount > 0
            ? `Recording ${recordingTabCount} tabs · ${elapsed} · ${eventCount} events · ${formatBytes(bytes)}`
            : `Recording · ${elapsed} · ${eventCount} events · ${formatBytes(bytes)}`
          : "Idle"}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={controlsDisabled || recordingActive || !disclaimerAccepted}
          onClick={onStart}
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        >
          Start recording
        </button>
        <button
          type="button"
          disabled={controlsDisabled || !recordingActive}
          onClick={onStop}
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Stop recording"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1">
        {MARKERS.map((label) => {
          const isMarked = markedLabels.includes(label);
          const isMarking = markingLabel === label;
          const markerDisabled =
            controlsDisabled || !recordingActive || isMarked || isMarking;

          return (
            <button
              key={label}
              type="button"
              disabled={markerDisabled}
              aria-pressed={isMarked}
              onClick={() => onMark(label)}
              className={
                isMarked
                  ? "rounded border border-emerald-600 bg-emerald-950/80 px-2 py-1 text-xs text-emerald-200 disabled:opacity-100"
                  : "rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
              }
            >
              {isMarking ? `${label}…` : isMarked ? `✓ ${label}` : label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={controlsDisabled || !lastExport}
          onClick={onReExport}
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        >
          Re-export last session
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={onClear}
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        >
          Clear session
        </button>
      </div>

      {lastExport?.filename && (
        <div className="mt-3 rounded border border-zinc-700 p-2 text-xs text-zinc-300">
          <p className="font-medium text-zinc-400">Exported to:</p>
          <p className="mt-1 break-all font-mono">{lastExport.filename}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="text-sky-400 underline" onClick={() => void onShowInFolder()}>
              {folderLabel(os)}
            </button>
            <button type="button" className="text-sky-400 underline" onClick={() => void onCopyPath()}>
              Copy path
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
