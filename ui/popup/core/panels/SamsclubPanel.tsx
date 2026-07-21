import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { SamsclubAtcToggles } from "../../domains/samsclub/components/SamsclubAtcToggles.tsx";
import { SamsclubAutoModeSection } from "../../domains/samsclub/components/SamsclubAutoModeSection.tsx";
import { SamsclubScheduleSection } from "../../domains/samsclub/components/SamsclubScheduleSection.tsx";
import { SamsclubResearchSection } from "../../domains/samsclub/components/SamsclubResearchSection.tsx";
import { useSamsclubAtcMode } from "../../domains/samsclub/hooks/useSamsclubAtcMode.ts";
import { useSamsclubAtcQuantity } from "../../domains/samsclub/hooks/useSamsclubAtcQuantity.ts";
import { useSamsclubAutoCheckout } from "../../domains/samsclub/hooks/useSamsclubAutoCheckout.ts";
import { useSamsclubCheckoutCvv } from "../../domains/samsclub/hooks/useSamsclubCheckoutCvv.ts";
import { useSamsclubAutoMode } from "../../domains/samsclub/hooks/useSamsclubAutoMode.ts";
import { useSamsclubSchedule } from "../../domains/samsclub/hooks/useSamsclubSchedule.ts";
import { useSamsclubRecording } from "../../domains/samsclub/hooks/useSamsclubRecording.ts";

interface SamsclubPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

function SamsclubRecordingSection({
  status,
  disabled,
}: {
  status: ExtensionStatus;
  disabled: boolean;
}) {
  const samsclubRecording = useSamsclubRecording(
    status.enabled,
    status.samsclub_recording_active,
    status.any_samsclub_tab_open,
  );

  if (!status.enabled) {
    return null;
  }

  return (
    <SamsclubResearchSection
      openTabs={status.samsclub_open_tabs}
      recordingActive={samsclubRecording.metrics.recordingActive}
      recordingTabCount={status.samsclub_recording_tab_count}
      eventCount={samsclubRecording.metrics.eventCount}
      bytes={samsclubRecording.metrics.bytes}
      startedAt={samsclubRecording.metrics.startedAt}
      lastExport={samsclubRecording.lastExport}
      disclaimerAccepted={samsclubRecording.disclaimerAccepted}
      disabled={samsclubRecording.disabled || disabled}
      acting={samsclubRecording.acting}
      exporting={samsclubRecording.exporting}
      actionError={samsclubRecording.actionError}
      markedLabels={samsclubRecording.markedLabels}
      markingLabel={samsclubRecording.markingLabel}
      onAcceptDisclaimer={samsclubRecording.acceptDisclaimer}
      onStart={() => void samsclubRecording.runAction("start")}
      onStop={() => void samsclubRecording.runAction("stop")}
      onMark={(label) => void samsclubRecording.markStage(label)}
      onReExport={() => void samsclubRecording.runAction("export")}
      onClear={() => void samsclubRecording.runAction("clear")}
      onShowInFolder={() => void samsclubRecording.showInFolder()}
      onCopyPath={() => void samsclubRecording.copyPath()}
    />
  );
}

export function SamsclubPanel({ status, disabled, onRefresh }: SamsclubPanelProps) {
  const panelActive = true;
  const samsclubAuto = useSamsclubAutoMode(status.enabled, panelActive, status);
  const samsclubAtc = useSamsclubAtcMode(panelActive, status);
  const samsclubAutoCheckout = useSamsclubAutoCheckout(panelActive, status);
  const samsclubCheckoutCvv = useSamsclubCheckoutCvv(
    panelActive,
    samsclubAutoCheckout.mode === "all",
    status,
  );
  const samsclubAtcQuantity = useSamsclubAtcQuantity(panelActive, status);
  const samsclubSchedule = useSamsclubSchedule(panelActive, status, onRefresh);

  return (
    <div className="space-y-3">
      {status.enabled && (
        <>
          <SamsclubAtcToggles
            frontendEnabled={samsclubAtc.frontendEnabled}
            backendEnabled={samsclubAtc.backendEnabled}
            autoCheckoutMode={samsclubAutoCheckout.mode}
            disabled={disabled}
            saving={samsclubAtc.saving}
            saveError={samsclubAtc.saveError}
            autoCheckoutSaving={samsclubAutoCheckout.saving}
            autoCheckoutSaveError={samsclubAutoCheckout.saveError}
            onFrontendChange={(next) => void samsclubAtc.handleFrontendChange(next)}
            onBackendChange={(next) => void samsclubAtc.handleBackendChange(next)}
            onAutoCheckoutModeChange={(next) => void samsclubAutoCheckout.onChange(next)}
            checkoutCvvVisible={samsclubCheckoutCvv.visible}
            checkoutCvvDraft={samsclubCheckoutCvv.draftCvv}
            checkoutCvvSaving={samsclubCheckoutCvv.saving}
            checkoutCvvSaveError={samsclubCheckoutCvv.saveError}
            checkoutCvvDraftInvalid={samsclubCheckoutCvv.draftInvalid}
            onCheckoutCvvChange={samsclubCheckoutCvv.handleChange}
            onCheckoutCvvFocus={samsclubCheckoutCvv.handleFocus}
            onCheckoutCvvBlur={samsclubCheckoutCvv.handleBlur}
            onCheckoutCvvClear={() => void samsclubCheckoutCvv.handleClear()}
            quantityDraft={samsclubAtcQuantity.draftQuantity}
            purchaseLimit={samsclubAtcQuantity.purchaseLimit}
            effectiveUseMax={samsclubAtcQuantity.effectiveUseMax}
            maxToggleChecked={samsclubAtcQuantity.maxToggleChecked}
            quantitySaving={samsclubAtcQuantity.saving}
            quantitySaveError={samsclubAtcQuantity.saveError}
            draftInvalid={samsclubAtcQuantity.draftInvalid}
            showInvalidError={samsclubAtcQuantity.showInvalidError}
            onQuantityChange={samsclubAtcQuantity.handleQuantityChange}
            onQuantityBlur={samsclubAtcQuantity.handleQuantityBlur}
            onQuantityFocus={samsclubAtcQuantity.handleQuantityFocus}
            onUseMaxChange={(next) => void samsclubAtcQuantity.handleUseMaxChange(next)}
          />

          <SamsclubAutoModeSection
            openTabs={status.samsclub_open_tabs}
            showControls={status.samsclub_tab_detected}
            refreshIntervalSec={samsclubAuto.refreshIntervalSec}
            manualStatus={samsclubAuto.manualStatus}
            manualRunning={samsclubAuto.manualRunning}
            refreshDisabled={samsclubAuto.refreshDisabled || disabled}
            savingRefresh={samsclubAuto.savingRefresh}
            refreshError={samsclubAuto.refreshError}
            acting={samsclubAuto.acting}
            actionError={samsclubAuto.actionError}
            autoStartBlocked={status.samsclub_auto_start_blocked}
            purchaseLimit={status.samsclub_purchase_limit}
            onRefreshIntervalChange={(intervalSec) =>
              void samsclubAuto.handleRefreshIntervalChange(intervalSec)
            }
            onStartManual={() => void samsclubAuto.handleStartManual()}
            onStopManual={() => void samsclubAuto.handleStopManual()}
          />

          <SamsclubScheduleSection
            enabled={samsclubSchedule.enabled}
            startTime={samsclubSchedule.startTime}
            endTime={samsclubSchedule.endTime}
            stopOnOos={samsclubSchedule.stopOnOos}
            scheduleStatus={samsclubSchedule.scheduleStatus}
            disabled={disabled}
            saving={samsclubSchedule.saving}
            saveError={samsclubSchedule.saveError}
            onEnabledChange={samsclubSchedule.handleEnabledChange}
            onStartTimeCommit={samsclubSchedule.commitStartTime}
            onEndTimeCommit={samsclubSchedule.commitEndTime}
            onStopOnOosChange={samsclubSchedule.handleStopOnOosChange}
          />
        </>
      )}

      {status.samsclub_recording_ui_enabled && (
        <SamsclubRecordingSection status={status} disabled={disabled} />
      )}
    </div>
  );
}
