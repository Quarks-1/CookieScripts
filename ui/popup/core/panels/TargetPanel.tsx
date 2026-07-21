import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { RetailerAutoModeSection } from "../../domains/target/components/RetailerAutoModeSection.tsx";
import { RetailerScheduleSection } from "../../domains/target/components/RetailerScheduleSection.tsx";
import { TargetAtcToggles } from "../../domains/target/components/TargetAtcToggles.tsx";
import { TargetAutoAtcSection } from "../../domains/target/components/TargetAutoAtcSection.tsx";
import { TargetLinkSettingsSection } from "../../domains/target/components/TargetLinkSettingsSection.tsx";
import { useRetailerAutoCheckout } from "../../domains/target/hooks/useRetailerAutoCheckout.ts";
import { useRetailerAtcMode } from "../../domains/target/hooks/useRetailerAtcMode.ts";
import { useRetailerAtcQuantity } from "../../domains/target/hooks/useRetailerAtcQuantity.ts";
import { useRetailerAutoMode } from "../../domains/target/hooks/useRetailerAutoMode.ts";
import { useRetailerSchedule } from "../../domains/target/hooks/useRetailerSchedule.ts";

interface TargetPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function TargetPanel({ status, disabled, onRefresh }: TargetPanelProps) {
  const panelActive = true;
  const retailerAuto = useRetailerAutoMode(
    status.active_channel_id,
    status.enabled,
    panelActive,
    status,
  );
  const retailerAtc = useRetailerAtcMode(panelActive, status);
  const retailerAutoCheckout = useRetailerAutoCheckout(panelActive, status);
  const retailerAtcQuantity = useRetailerAtcQuantity(panelActive, status);
  const retailerSchedule = useRetailerSchedule(panelActive, status, onRefresh);

  return (
    <div className="space-y-3">
      <TargetLinkSettingsSection status={status} disabled={disabled} onRefresh={onRefresh} />

      <TargetAutoAtcSection status={status} disabled={disabled} onRefresh={onRefresh} />

      <TargetAtcToggles
        frontendEnabled={retailerAtc.frontendEnabled}
        backendEnabled={retailerAtc.backendEnabled}
        autoCheckoutMode={retailerAutoCheckout.mode}
        autoAtcEnabled={status.retailer_auto_atc_enabled}
        disabled={disabled}
        saving={retailerAtc.saving}
        saveError={retailerAtc.saveError}
        autoCheckoutSaving={retailerAutoCheckout.saving}
        autoCheckoutSaveError={retailerAutoCheckout.saveError}
        onFrontendChange={(next) => void retailerAtc.handleFrontendChange(next)}
        onBackendChange={(next) => void retailerAtc.handleBackendChange(next)}
        onAutoCheckoutModeChange={(next) => void retailerAutoCheckout.onChange(next)}
        quantityDraft={retailerAtcQuantity.draftQuantity}
        purchaseLimit={retailerAtcQuantity.purchaseLimit}
        effectiveUseMax={retailerAtcQuantity.effectiveUseMax}
        maxToggleChecked={retailerAtcQuantity.maxToggleChecked}
        quantitySaving={retailerAtcQuantity.saving}
        quantitySaveError={retailerAtcQuantity.saveError}
        draftInvalid={retailerAtcQuantity.draftInvalid}
        showInvalidError={retailerAtcQuantity.showInvalidError}
        onQuantityChange={retailerAtcQuantity.handleQuantityChange}
        onQuantityBlur={retailerAtcQuantity.handleQuantityBlur}
        onQuantityFocus={retailerAtcQuantity.handleQuantityFocus}
        onUseMaxChange={(next) => void retailerAtcQuantity.handleUseMaxChange(next)}
      />

      <RetailerAutoModeSection
        openTabs={status.retailer_open_tabs}
        showControls={status.retailer_tab_detected}
        refreshIntervalSec={retailerAuto.refreshIntervalSec}
        manualStatus={retailerAuto.manualStatus}
        manualRunning={retailerAuto.manualRunning}
        refreshDisabled={retailerAuto.refreshDisabled || disabled}
        savingRefresh={retailerAuto.savingRefresh}
        refreshError={retailerAuto.refreshError}
        acting={retailerAuto.acting}
        actionError={retailerAuto.actionError}
        autoStartBlocked={status.retailer_auto_start_blocked}
        purchaseLimit={status.retailer_purchase_limit}
        onRefreshIntervalChange={(intervalSec) =>
          void retailerAuto.handleRefreshIntervalChange(intervalSec)
        }
        onStartManual={() => void retailerAuto.handleStartManual()}
        onStopManual={() => void retailerAuto.handleStopManual()}
      />

      <RetailerScheduleSection
        enabled={retailerSchedule.enabled}
        startTime={retailerSchedule.startTime}
        endTime={retailerSchedule.endTime}
        stopOnOos={retailerSchedule.stopOnOos}
        closeTabOnOos={retailerSchedule.closeTabOnOos}
        scheduleStatus={retailerSchedule.scheduleStatus}
        disabled={disabled}
        saving={retailerSchedule.saving}
        saveError={retailerSchedule.saveError}
        onEnabledChange={retailerSchedule.handleEnabledChange}
        onStartTimeCommit={retailerSchedule.commitStartTime}
        onEndTimeCommit={retailerSchedule.commitEndTime}
        onStopOnOosChange={retailerSchedule.handleStopOnOosChange}
        onCloseTabOnOosChange={retailerSchedule.handleCloseTabOnOosChange}
      />
    </div>
  );
}
