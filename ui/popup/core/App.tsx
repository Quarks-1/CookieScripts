import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
  sendToBackground,
} from "@ext/core/lib/messages.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";
import { LinkHistory } from "@shared/components/LinkHistory.tsx";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { WatchStatusBadge } from "@shared/components/WatchStatusBadge.tsx";
import { ChannelDomainsSection } from "../domains/discord/components/ChannelDomainsSection.tsx";
import { ChannelKeywordsSection } from "../domains/discord/components/ChannelKeywordsSection.tsx";
import { DetectedLinksSection } from "../domains/discord/components/DetectedLinksSection.tsx";
import { useChannelDiscordSettings } from "../domains/discord/hooks/useChannelDiscordSettings.ts";
import { useDetectedLinks } from "../domains/discord/hooks/useDetectedLinks.ts";
import { useLinkHistory } from "../domains/discord/hooks/useLinkHistory.ts";
import { RetailerAutoModeSection } from "../domains/target/components/RetailerAutoModeSection.tsx";
import { TargetAtcToggles } from "../domains/target/components/TargetAtcToggles.tsx";
import { useRetailerAutoCheckout } from "../domains/target/hooks/useRetailerAutoCheckout.ts";
import { useRetailerAtcMode } from "../domains/target/hooks/useRetailerAtcMode.ts";
import { useRetailerAtcQuantity } from "../domains/target/hooks/useRetailerAtcQuantity.ts";
import { useRetailerAutoMode } from "../domains/target/hooks/useRetailerAutoMode.ts";
import { WalmartResearchSection } from "../domains/walmart/components/WalmartResearchSection.tsx";
import { WalmartAutoRefreshSection } from "../domains/walmart/components/WalmartAutoRefreshSection.tsx";
import { useWalmartRecording } from "../domains/walmart/hooks/useWalmartRecording.ts";
import { useWalmartAutoRefresh } from "../domains/walmart/hooks/useWalmartAutoRefresh.ts";
import { useWalmartQueueSettings } from "../domains/walmart/hooks/useWalmartQueueSettings.ts";
import { VersionStatus } from "./components/VersionStatus.tsx";
import { usePopupStatus } from "./hooks/usePopupStatus.ts";
import { useUpdateCheck } from "./hooks/useUpdateCheck.ts";
import { isSectionVisible } from "./sidepanel-layout.ts";

export default function App() {
  const { status, loading, error, refresh } = usePopupStatus();
  const discordSurface = status?.active_tab_kind === "discord_channel";
  const retailerSurface = status?.active_tab_kind === "retailer";
  const discordSettings = useChannelDiscordSettings(
    discordSurface ? (status?.active_channel_id ?? null) : null,
    (status?.enabled ?? false) && discordSurface,
  );
  const detectedLinks = useDetectedLinks(
    discordSurface ? (status?.active_channel_id ?? null) : null,
    (status?.enabled ?? false) && discordSurface,
    discordSettings.domains,
    discordSettings.handleAcceptDomain,
  );
  const linkHistory = useLinkHistory();
  const updateCheck = useUpdateCheck();
  const retailerAuto = useRetailerAutoMode(
    status?.active_channel_id ?? null,
    status?.enabled ?? false,
    retailerSurface,
  );
  const retailerAtc = useRetailerAtcMode(status?.retailer_tab_detected === true);
  const retailerAutoCheckout = useRetailerAutoCheckout(status?.retailer_tab_detected === true);
  const retailerAtcQuantity = useRetailerAtcQuantity(
    status?.retailer_tab_detected === true,
    status,
  );
  const walmartRecording = useWalmartRecording(
    status?.enabled ?? false,
    status?.walmart_recording_active ?? false,
    status?.any_walmart_tab_open ?? false,
  );
  const walmartAutoRefresh = useWalmartAutoRefresh(
    status?.walmart_tab_detected === true,
    status?.enabled ?? false,
  );
  const walmartQueueSettings = useWalmartQueueSettings(
    status?.walmart_tab_detected === true,
    status?.enabled ?? false,
  );
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [autoAtcSaving, setAutoAtcSaving] = useState(false);
  const [autoAtcError, setAutoAtcError] = useState<string | null>(null);

  async function handleAutoAtcChange(next: boolean) {
    const channelId = status?.active_channel_id;
    if (channelId === null || channelId === undefined) {
      return;
    }
    setAutoAtcSaving(true);
    setAutoAtcError(null);
    try {
      const response = await sendToBackground<BackgroundResponse>({
        type: "SET_RETAILER_AUTO_ATC_ENABLED",
        channel_id: channelId,
        enabled: next,
      });
      if ("ok" in response && response.ok === false) {
        throw new Error(response.error);
      }
      await refresh();
    } catch (err) {
      setAutoAtcError(err instanceof Error ? err.message : "Failed to save");
      await refresh();
    } finally {
      setAutoAtcSaving(false);
    }
  }

  async function handleEnabledChange(next: boolean) {
    setEnabling(true);
    setEnableError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, enabled: next });
      await refresh();
    } catch (err) {
      setEnableError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEnabling(false);
    }
  }

  return (
    <main className="w-full min-w-72 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">CookieScripts</h1>
        <VersionStatus
          installedVersion={updateCheck.installedVersion}
          checking={updateCheck.checking}
          updateAvailable={updateCheck.updateAvailable}
          releaseUrl={updateCheck.releaseUrl}
        />
      </div>

      <section aria-labelledby="popup-enable-heading" className="mt-3">
        <h2 id="popup-enable-heading" className="sr-only">
          Extension enabled
        </h2>
        {status !== null ? (
          <EnableSlider
            id="popup-global-enabled"
            checked={status.enabled}
            disabled={enabling}
            onChange={(next) => void handleEnabledChange(next)}
          />
        ) : (
          <label className="flex cursor-wait items-center justify-between gap-3 text-sm opacity-60">
            <span className="text-zinc-300">Enable extension</span>
            <span
              aria-hidden="true"
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-zinc-800"
            />
          </label>
        )}
        {enabling && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {enableError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {enableError}
          </p>
        )}
      </section>

      {status?.walmart_tab_detected && (
        <WalmartAutoRefreshSection
          enabled={walmartAutoRefresh.autoRefreshEnabled}
          refreshIntervalSec={walmartAutoRefresh.refreshIntervalSec}
          throttleRefreshIntervalSec={walmartQueueSettings.throttleRefreshIntervalSec}
          queuePassSoundEnabled={walmartQueueSettings.queuePassSoundEnabled}
          consolidateQueueTabsEnabled={walmartQueueSettings.consolidateQueueTabsEnabled}
          disabled={!status.enabled || enabling}
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
      )}

      {discordSurface && status !== null && (
        <>
          <section aria-labelledby="popup-auto-atc-heading" className="mt-3">
            <h2 id="popup-auto-atc-heading" className="sr-only">
              Auto ATC
            </h2>
            <EnableSlider
              id="popup-retailer-auto-atc"
              label="Enable Auto ATC"
              checked={status.retailer_auto_atc_enabled}
              disabled={
                !status.enabled ||
                enabling ||
                autoAtcSaving ||
                status.active_channel_id === null ||
                !status.has_allowed_domains
              }
              onChange={(next) => void handleAutoAtcChange(next)}
            />
            <p className="mt-1 text-xs text-zinc-500">
              {status.has_allowed_domains
                ? "For this channel: opens Target product links in a new window and runs add-to-cart automation."
                : "Add at least one allowed domain to enable Auto ATC."}
            </p>
            {autoAtcSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
            {autoAtcError && (
              <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
                {autoAtcError}
              </p>
            )}
          </section>

          <div className="mt-3 space-y-3">
            {isSectionVisible("watchStatus", status) && (
              <section aria-label="Status">
                <WatchStatusBadge status={status} />
              </section>
            )}

            <ChannelKeywordsSection
              channelId={status.active_channel_id}
              positiveKeywords={discordSettings.positiveKeywords}
              negativeKeywords={discordSettings.negativeKeywords}
              disabled={
                discordSettings.disabled ||
                enabling ||
                !status.has_allowed_domains
              }
              saving={discordSettings.saving}
              saveError={discordSettings.saveError}
              onPositiveKeywordsChange={discordSettings.handlePositiveKeywordsChange}
              onNegativeKeywordsChange={discordSettings.handleNegativeKeywordsChange}
            />
          </div>
        </>
      )}

      {status?.retailer_tab_detected && (
        <TargetAtcToggles
          frontendEnabled={retailerAtc.frontendEnabled}
          backendEnabled={retailerAtc.backendEnabled}
          autoCheckoutEnabled={retailerAutoCheckout.enabled}
          disabled={!status.enabled || enabling}
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
      )}

      {loading && <p className="mt-3 text-sm text-zinc-400">Loading…</p>}

      {error && (
        <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {status && !loading && (
        <div className={`space-y-3 ${discordSurface ? "mt-3" : "mt-4"}`}>
          {isSectionVisible("channelDomains", status) && (
            <ChannelDomainsSection
              channelId={status.active_channel_id}
              domains={discordSettings.domains}
              disabled={discordSettings.disabled || enabling}
              saving={discordSettings.saving}
              saveError={discordSettings.saveError}
              onDomainsChange={discordSettings.handleDomainsChange}
            />
          )}

          {isSectionVisible("retailerAuto", status) && (
            <RetailerAutoModeSection
              refreshIntervalSec={retailerAuto.refreshIntervalSec}
              manualStatus={retailerAuto.manualStatus}
              manualRunning={retailerAuto.manualRunning}
              refreshDisabled={retailerAuto.refreshDisabled || enabling}
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
          )}

          {isSectionVisible("walmartResearch", status) && (
            <WalmartResearchSection
              openTabs={status.walmart_open_tabs}
              recordingActive={walmartRecording.metrics.recordingActive}
              recordingTabCount={status?.walmart_recording_tab_count ?? 0}
              eventCount={walmartRecording.metrics.eventCount}
              bytes={walmartRecording.metrics.bytes}
              startedAt={walmartRecording.metrics.startedAt}
              lastExport={walmartRecording.lastExport}
              disclaimerAccepted={walmartRecording.disclaimerAccepted}
              disabled={walmartRecording.disabled || enabling}
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
          )}

          {isSectionVisible("detectedLinks", status) && (
            <DetectedLinksSection
              domains={detectedLinks.domains}
              loading={detectedLinks.loading}
              acting={detectedLinks.acting}
              error={detectedLinks.error}
              disabled={detectedLinks.disabled || enabling}
              onAccept={(domain) => void detectedLinks.handleAccept(domain)}
              onDismiss={(domain) => void detectedLinks.handleDismiss(domain)}
              onRefresh={() => void detectedLinks.refresh()}
            />
          )}

          {isSectionVisible("globalHint", status) && (
            <section
              aria-labelledby="global-hint-heading"
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <h2 id="global-hint-heading" className="sr-only">
                Discord setup
              </h2>
              <p className="text-sm text-zinc-500">
                Open a Discord channel tab to configure domains and scan for links.
              </p>
            </section>
          )}

          {isSectionVisible("linkHistory", status) && (
            <section aria-labelledby="link-history-heading">
              <div className="flex items-center justify-between gap-2">
                <h2 id="link-history-heading" className="text-sm font-medium text-zinc-400">
                  Link history
                </h2>
                <button
                  type="button"
                  disabled={linkHistory.clearing || linkHistory.history.length === 0}
                  onClick={() => void linkHistory.handleClearHistory()}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
                >
                  {linkHistory.clearing ? "Clearing…" : "Clear"}
                </button>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto">
                {linkHistory.loading ? (
                  <p className="text-sm text-zinc-500">Loading history…</p>
                ) : (
                  <LinkHistory
                    items={linkHistory.history}
                    variant="compact"
                    emptyMessage="No links opened yet."
                  />
                )}
              </div>
              {linkHistory.clearMessage && (
                <p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-500">
                  {linkHistory.clearMessage}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
