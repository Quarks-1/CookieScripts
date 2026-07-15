import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { RetailerAutoModeSection } from "../../domains/target/components/RetailerAutoModeSection.tsx";
import { TargetAtcToggles } from "../../domains/target/components/TargetAtcToggles.tsx";
import { TargetAutoAtcSection } from "../../domains/target/components/TargetAutoAtcSection.tsx";
import { TargetLinkSettingsSection } from "../../domains/target/components/TargetLinkSettingsSection.tsx";
import { useRetailerAutoCheckout } from "../../domains/target/hooks/useRetailerAutoCheckout.ts";
import { useRetailerAtcMode } from "../../domains/target/hooks/useRetailerAtcMode.ts";
import { useRetailerAtcQuantity } from "../../domains/target/hooks/useRetailerAtcQuantity.ts";
import { useRetailerAutoMode } from "../../domains/target/hooks/useRetailerAutoMode.ts";

interface TargetPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function TargetPanel({ status, disabled, onRefresh }: TargetPanelProps) {
  const panelActive = true;
  const retailerAuto = useRetailerAutoMode(status.active_channel_id, status.enabled, panelActive);
  const retailerAtc = useRetailerAtcMode(panelActive);
  const retailerAutoCheckout = useRetailerAutoCheckout(panelActive);
  const retailerAtcQuantity = useRetailerAtcQuantity(panelActive, status);

  return (
    <div className="space-y-3">
      <TargetLinkSettingsSection status={status} disabled={disabled} onRefresh={onRefresh} />

      <TargetAutoAtcSection status={status} disabled={disabled} onRefresh={onRefresh} />

      <TargetAtcToggles
        frontendEnabled={retailerAtc.frontendEnabled}
        backendEnabled={retailerAtc.backendEnabled}
        autoCheckoutEnabled={retailerAutoCheckout.enabled}
        disabled={disabled}
        saving={retailerAtc.saving}
        saveError={retailerAtc.saveError}
        autoCheckoutSaving={retailerAutoCheckout.saving}
        autoCheckoutSaveError={retailerAutoCheckout.saveError}
        onFrontendChange={(next) => void retailerAtc.handleFrontendChange(next)}
        onBackendChange={(next) => void retailerAtc.handleBackendChange(next)}
        onAutoCheckoutChange={(next) => void retailerAutoCheckout.onChange(next)}
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
    </div>
  );
}
