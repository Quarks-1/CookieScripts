import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { WalmartResearchSection } from "../../domains/walmart/components/WalmartResearchSection.tsx";
import { WalmartAutoRefreshSection } from "../../domains/walmart/components/WalmartAutoRefreshSection.tsx";
import { useWalmartRecording } from "../../domains/walmart/hooks/useWalmartRecording.ts";
import { useWalmartAutoRefresh } from "../../domains/walmart/hooks/useWalmartAutoRefresh.ts";
import { useWalmartQueueSettings } from "../../domains/walmart/hooks/useWalmartQueueSettings.ts";

interface WalmartPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

function WalmartRecordingSection({
  status,
  disabled,
}: {
  status: ExtensionStatus;
  disabled: boolean;
}) {
  const walmartRecording = useWalmartRecording(
    status.enabled,
    status.walmart_recording_active,
    status.any_walmart_tab_open,
  );

  if (!status.enabled) {
    return null;
  }

  return (
    <WalmartResearchSection
      openTabs={status.walmart_open_tabs}
      recordingActive={walmartRecording.metrics.recordingActive}
      recordingTabCount={status.walmart_recording_tab_count}
      eventCount={walmartRecording.metrics.eventCount}
      bytes={walmartRecording.metrics.bytes}
      startedAt={walmartRecording.metrics.startedAt}
      lastExport={walmartRecording.lastExport}
      disclaimerAccepted={walmartRecording.disclaimerAccepted}
      disabled={walmartRecording.disabled || disabled}
      acting={walmartRecording.acting}
      exporting={walmartRecording.exporting}
      actionError={walmartRecording.actionError}
      markedLabels={walmartRecording.markedLabels}
      markingLabel={walmartRecording.markingLabel}
      onAcceptDisclaimer={walmartRecording.acceptDisclaimer}
      onStart={() => void walmartRecording.runAction("start")}
      onStop={() => void walmartRecording.runAction("stop")}
      onMark={(label) => void walmartRecording.markStage(label)}
      onReExport={() => void walmartRecording.runAction("export")}
      onClear={() => void walmartRecording.runAction("clear")}
      onShowInFolder={() => void walmartRecording.showInFolder()}
      onCopyPath={() => void walmartRecording.copyPath()}
    />
  );
}

export function WalmartPanel({ status, disabled }: WalmartPanelProps) {
  const panelActive = true;
  const walmartAutoRefresh = useWalmartAutoRefresh(panelActive, status.enabled);
  const walmartQueueSettings = useWalmartQueueSettings(panelActive, status.enabled);

  return (
    <div className="space-y-3">
      <WalmartAutoRefreshSection
        enabled={walmartAutoRefresh.autoRefreshEnabled}
        refreshIntervalSec={walmartAutoRefresh.refreshIntervalSec}
        throttleRefreshIntervalSec={walmartQueueSettings.throttleRefreshIntervalSec}
        queuePassSoundEnabled={walmartQueueSettings.queuePassSoundEnabled}
        consolidateQueueTabsEnabled={walmartQueueSettings.consolidateQueueTabsEnabled}
        disabled={disabled}
        savingRefresh={walmartAutoRefresh.savingRefresh}
        savingEnabled={walmartAutoRefresh.savingEnabled}
        savingQueueSettings={walmartQueueSettings.saving}
        refreshError={walmartAutoRefresh.refreshError}
        enableError={walmartAutoRefresh.enableError}
        queueSettingsError={walmartQueueSettings.error}
        onEnabledChange={(next) => void walmartAutoRefresh.handleEnabledChange(next)}
        onRefreshIntervalChange={(intervalSec) =>
          void walmartAutoRefresh.handleRefreshIntervalChange(intervalSec)
        }
        onThrottleRefreshIntervalChange={(intervalSec) =>
          void walmartQueueSettings.handleThrottleIntervalChange(intervalSec)
        }
        onQueuePassSoundChange={(next) => void walmartQueueSettings.handleQueuePassSoundChange(next)}
        onConsolidateQueueTabsChange={(next) =>
          void walmartQueueSettings.handleConsolidateQueueTabsChange(next)
        }
      />

      {status.walmart_recording_ui_enabled && (
        <WalmartRecordingSection status={status} disabled={disabled} />
      )}
    </div>
  );
}
