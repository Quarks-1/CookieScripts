import { runAutomationPlayback } from "@ext/domains/target/content/automation/playback.ts";
import type { RetailerAutoConfig } from "@ext/domains/target/content/automation/checkout-auto.ts";
import { probeAddToCartViaApi } from "@ext/domains/target/lib/cart-api.ts";
import {
  parseTargetTcinFromUrl,
  waitForMainAddToCartButton,
  type WaitForAtcResult,
} from "@ext/domains/target/lib/main-add-to-cart.ts";
import {
  clearRetailerAutoResume,
  clearRetailerAutoUserStopped,
  ensureRetailerAutoResume,
  isRetailerAutoUserStopped,
  markRetailerAutoUserStopped,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  startRetailerAutoResume,
  transitionRetailerAutoResumeToCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import { ensurePageCartProbeBridge } from "@ext/domains/target/lib/page-cart-probe-bridge.ts";
import { defaultTargetAutomationSteps } from "@ext/domains/target/lib/playback-engine.ts";
import {
  isEffectiveUseMax,
  isQuantityInvalid,
  readPurchaseLimitForAutomation,
  readPurchaseLimitFromNextData,
  resolveEffectiveQuantity,
} from "@ext/domains/target/lib/quantity-limit.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/domains/target/lib/selectors.ts";
import { isExtensionContextInvalidatedError, isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";
import { endSession } from "@ext/domains/target/content/session/lifecycle.ts";
import {
  publishUiState,
  reportAutoStatus,
  sendToBackground,
  syncManualAutoStartToBackground,
  syncManualAutoStopToBackground,
} from "@ext/domains/target/content/session/messaging.ts";
import { scheduleAutomationRun } from "@ext/domains/target/content/session/schedule.ts";
import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/target/content/session/session-state.ts";

export type StartAutoMessage = Extract<BackgroundToContent, { type: "RETAILER_START_AUTO" }>;

export function requestStopAutoMode(): void {
  state.stopAutoRequested = true;
  state.automationScheduled = false;
  markRetailerAutoUserStopped();
  syncManualAutoStopToBackground();
  session.syncGeneration += 1;
  session.running = false;
}

function allowAutoModeStart(): void {
  state.stopAutoRequested = false;
  clearRetailerAutoUserStopped();
  syncManualAutoStartToBackground();
}

export function shouldContinueAutoMode(): boolean {
  return (
    session.running &&
    !state.stopAutoRequested &&
    !state.sessionEnded &&
    isExtensionContextValid()
  );
}

export async function loadAutoConfig(channelId: string): Promise<RetailerAutoConfig> {
  const defaults: RetailerAutoConfig = {
    refreshIntervalSec: 0,
    frontendAtcEnabled: true,
    backendAtcEnabled: false,
    atcQuantity: 1,
    useMaxQuantity: false,
    autoCheckoutEnabled: false,
    stopOnOosEnabled: false,
    closeTabOnOosEnabled: false,
  };
  if (!isExtensionContextValid()) {
    endSession();
    return defaults;
  }
  try {
    const response = (await sendToBackground({
      type: "RETAILER_GET_AUTO_CONFIG",
      channel_id: channelId,
    })) as {
      ok?: boolean;
      refresh_interval_sec?: number;
      frontend_atc_enabled?: boolean;
      backend_atc_enabled?: boolean;
      atc_quantity?: number;
      use_max_quantity?: boolean;
      auto_checkout_enabled?: boolean;
      stop_on_oos_enabled?: boolean;
      close_tab_on_oos_enabled?: boolean;
    };
    return {
      refreshIntervalSec:
        response?.ok === true && typeof response.refresh_interval_sec === "number"
          ? response.refresh_interval_sec
          : 0,
      frontendAtcEnabled:
        response?.ok === true && response.frontend_atc_enabled === false ? false : true,
      backendAtcEnabled: response?.ok === true && response.backend_atc_enabled === true,
      atcQuantity:
        response?.ok === true && typeof response.atc_quantity === "number"
          ? Math.max(1, Math.floor(response.atc_quantity))
          : 1,
      useMaxQuantity: response?.ok === true && response.use_max_quantity === true,
      autoCheckoutEnabled: response?.ok === true && response.auto_checkout_enabled === true,
      stopOnOosEnabled: response?.ok === true && response.stop_on_oos_enabled === true,
      closeTabOnOosEnabled: response?.ok === true && response.close_tab_on_oos_enabled === true,
    };
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
    return defaults;
  }
}

function applyStartAutoConfig(message: StartAutoMessage): boolean {
  if (typeof message.refresh_interval_sec !== "number") {
    return false;
  }

  state.cachedRefreshIntervalSec = message.refresh_interval_sec;
  state.cachedFrontendAtcEnabled = message.frontend_atc_enabled !== false;
  state.cachedBackendAtcEnabled = message.backend_atc_enabled === true;
  state.cachedAtcQuantity =
    typeof message.atc_quantity === "number"
      ? Math.max(1, Math.floor(message.atc_quantity))
      : 1;
  state.cachedUseMaxQuantity = message.use_max_quantity === true;
  state.cachedAutoCheckoutEnabled = message.auto_checkout_enabled === true;
  return true;
}

function getEffectiveQuantityFromPage(purchaseLimit: number | null): number {
  const effectiveUseMax = isEffectiveUseMax(state.cachedUseMaxQuantity, purchaseLimit);
  return resolveEffectiveQuantity({
    quantity: state.cachedAtcQuantity,
    useMaxQuantity: effectiveUseMax,
    purchaseLimit,
  });
}

function failQuantityGate(purchaseLimit: number | null): boolean {
  if (purchaseLimit == null) {
    return false;
  }

  const effectiveUseMax = isEffectiveUseMax(state.cachedUseMaxQuantity, purchaseLimit);
  if (!isQuantityInvalid(state.cachedAtcQuantity, purchaseLimit, effectiveUseMax)) {
    return false;
  }

  const message = `Quantity (${state.cachedAtcQuantity}) exceeds max (${purchaseLimit})`;
  publishUiState(message, false);
  void reportAutoStatus("failed", message);
  clearRetailerAutoResume();
  session.running = false;
  return true;
}

export function syncCartProbeBridge(): void {
  if (!isExtensionContextValid() || state.sessionEnded) {
    return;
  }
  if (state.cachedBackendAtcEnabled && isRetailerProductUrl(location.href)) {
    void ensurePageCartProbeBridge(document).catch(() => {
      // Bridge injection can fail after extension reload; auto mode handles probe fallback.
    });
  }
}

async function warmCartProbeBridge(): Promise<void> {
  if (state.cachedBackendAtcEnabled && isRetailerProductUrl(location.href)) {
    await ensurePageCartProbeBridge(document);
  }
}

async function requestHardReload(): Promise<void> {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  try {
    await sendToBackground({ type: "RETAILER_HARD_RELOAD" });
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  }
}

export function autoModePlaybackOptions(
  getRefreshIntervalSec: () => number,
  getEffectiveQuantity: () => number,
  cartAlreadyAdded = false,
): import("@ext/domains/target/content/automation/playback.ts").AutomationPlaybackOptions {
  return {
    shouldContinue: shouldContinueAutoMode,
    refreshIntervalSec: getRefreshIntervalSec(),
    getRefreshIntervalSec,
    requestHardReload,
    frontendAtcEnabled: state.cachedFrontendAtcEnabled,
    backendAtcEnabled: state.cachedBackendAtcEnabled,
    cartAlreadyAdded,
    getEffectiveQuantity,
    onBeforeCheckoutNavigate: () => {
      if (state.cachedAutoCheckoutEnabled && session.channelId) {
        transitionRetailerAutoResumeToCheckout(session.channelId, location.href);
      }
    },
  };
}

async function requestCloseTabOnOos(): Promise<void> {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  try {
    await sendToBackground({ type: "RETAILER_CLOSE_TAB_ON_OOS" });
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  }
}

function handleTargetOosConfirmed(): void {
  const stopOnOos = state.cachedStopOnOosEnabled;
  const closeTab = state.cachedCloseTabOnOosEnabled;
  if (stopOnOos) {
    state.stoppedDueToOos = true;
    requestStopAutoMode();
    publishUiState("Stopped — out of stock", false);
  }
  if (closeTab) {
    state.oosCloseTabRequested = true;
    void requestCloseTabOnOos();
  }
}

export async function runAutoMode(): Promise<void> {
  state.automationScheduled = false;
  state.stoppedDueToOos = false;
  state.oosCloseTabRequested = false;
  if (session.running || state.stopAutoRequested || isRetailerAutoUserStopped()) {
    return;
  }
  if (!isRetailerProductUrl(location.href)) {
    publishUiState("Open a product page (/p/…)", false);
    return;
  }

  session.running = true;
  publishUiState("Running auto mode…", true);

  if (!session.channelId) {
    session.running = false;
    publishUiState("Ready — open a product page and press Start", false);
    return;
  }

  let skipReadyInFinally = false;
  let skipRunningResetInFinally = false;

  try {
    const resuming = shouldResumeRetailerAuto(location.href) !== null;
    if (resuming) {
      ensureRetailerAutoResume(session.channelId, location.href);
    } else {
      startRetailerAutoResume(session.channelId, location.href);
    }

    const config = state.autoConfigPrefetched
      ? {
          refreshIntervalSec: state.cachedRefreshIntervalSec,
          frontendAtcEnabled: state.cachedFrontendAtcEnabled,
          backendAtcEnabled: state.cachedBackendAtcEnabled,
          atcQuantity: state.cachedAtcQuantity,
          useMaxQuantity: state.cachedUseMaxQuantity,
          autoCheckoutEnabled: state.cachedAutoCheckoutEnabled,
          stopOnOosEnabled: state.cachedStopOnOosEnabled,
          closeTabOnOosEnabled: state.cachedCloseTabOnOosEnabled,
        }
      : await loadAutoConfig(session.channelId);
    state.autoConfigPrefetched = false;
    applyCachedAutoConfig(config);
    await warmCartProbeBridge();

    if (!state.cachedFrontendAtcEnabled && !state.cachedBackendAtcEnabled) {
      publishUiState("Error: Enable Frontend ATC or Backend ATC", false);
      await reportAutoStatus("failed", "Enable Frontend ATC or Backend ATC");
      clearRetailerAutoResume();
      skipReadyInFinally = true;
      return;
    }

    const earlyPurchaseLimit = readPurchaseLimitFromNextData(document);
    if (failQuantityGate(earlyPurchaseLimit)) {
      skipReadyInFinally = true;
      return;
    }

    const getRefreshIntervalSec = () => state.cachedRefreshIntervalSec;
    const getEffectiveQuantity = () =>
      getEffectiveQuantityFromPage(readPurchaseLimitForAutomation(document));

    const readySelectors = DEFAULT_ADD_TO_CART_SELECTORS;

    let cartAlreadyAdded = false;
    if (state.cachedBackendAtcEnabled) {
      const tcin = parseTargetTcinFromUrl(location.href);
      if (tcin) {
        publishUiState("Adding to cart…", true);
        const probe = await probeAddToCartViaApi(
          tcin,
          {},
          getEffectiveQuantityFromPage(earlyPurchaseLimit),
        );
        cartAlreadyAdded = probe.kind === "added";
      }
    }

    let waitResult: WaitForAtcResult | null = cartAlreadyAdded ? { kind: "api_added" } : null;
    if (!waitResult) {
      publishUiState("Waiting for product page…", true);
      waitResult = await waitForMainAddToCartButton({
        selectors: readySelectors,
        timeoutMs: null,
        shouldContinue: shouldContinueAutoMode,
        pageUrl: location.href,
        onStatus: (text) => publishUiState(text, true),
        refreshIntervalSec: state.cachedRefreshIntervalSec,
        getRefreshIntervalSec,
        requestHardReload,
        frontendAtcEnabled: state.cachedFrontendAtcEnabled,
        backendAtcEnabled: state.cachedBackendAtcEnabled,
        getEffectiveQuantity,
        stopOnOosEnabled: state.cachedStopOnOosEnabled,
        closeTabOnOosEnabled: state.cachedCloseTabOnOosEnabled,
        onOosConfirmed: handleTargetOosConfirmed,
      });
    }
    if (!waitResult) {
      if (state.oosCloseTabRequested) {
        skipReadyInFinally = true;
        return;
      }
      if (state.stopAutoRequested) {
        if (!state.stoppedDueToOos) {
          publishUiState("Stopped", false);
        }
        await reportAutoStatus("failed", state.stoppedDueToOos ? "Out of stock" : "Stopped");
        skipReadyInFinally = true;
        return;
      }
      if (readRetailerAutoResume()) {
        return;
      }
      publishUiState("Error: Add to cart button not found", false);
      await reportAutoStatus("failed", "Add to cart button not found");
      clearRetailerAutoResume();
      skipReadyInFinally = true;
      return;
    }

    const cartAlreadyAddedFromWait = waitResult.kind === "api_added";

    const purchaseLimit = readPurchaseLimitForAutomation(document);
    if (failQuantityGate(purchaseLimit)) {
      skipReadyInFinally = true;
      return;
    }

    const effectiveQuantity = getEffectiveQuantityFromPage(purchaseLimit);
    const steps = defaultTargetAutomationSteps(effectiveQuantity);

    const result = await runAutomationPlayback(
      steps,
      (text) => publishUiState(text, true),
      autoModePlaybackOptions(getRefreshIntervalSec, getEffectiveQuantity, cartAlreadyAddedFromWait),
    );

    if (!result.ok && result.error === "Reloading") {
      return;
    }

    if (result.ok && state.cachedAutoCheckoutEnabled) {
      skipRunningResetInFinally = true;
      skipReadyInFinally = true;
      return;
    }

    clearRetailerAutoResume();

    if (result.ok) {
      publishUiState("Success", false);
      await reportAutoStatus("success");
      return;
    }

    if (result.error === "Stopped") {
      publishUiState("Stopped", false);
      await reportAutoStatus("failed", "Stopped");
      skipReadyInFinally = true;
      return;
    }

    publishUiState(`Error: ${result.error}`, false);
    await reportAutoStatus("failed", result.error);
    skipReadyInFinally = true;
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
      return;
    }
    publishUiState(err instanceof Error ? err.message : "Auto mode failed", false);
    skipReadyInFinally = true;
  } finally {
    if (!skipRunningResetInFinally) {
      session.running = false;
    }
    if (!state.sessionEnded && !readRetailerAutoResume() && !skipReadyInFinally) {
      publishUiState(
        isRetailerProductUrl(location.href)
          ? "Ready — press Start Auto Mode"
          : "Ready — open a product page and press Start",
        false,
      );
    }
  }
}

function armManualSession(): void {
  session.channelId = "manual";
  session.url = location.href;
}

export function handleStartAuto(message: StartAutoMessage): void {
  allowAutoModeStart();
  session.channelId = message.channel_id;
  session.url = message.url;
  state.autoConfigPrefetched = applyStartAutoConfig(message);
  void warmCartProbeBridge();
  publishUiState("Running auto mode…", true);
  scheduleAutomationRun(runAutoMode);
}

export function handleStartManualAuto(hardRefresh = false): void {
  allowAutoModeStart();
  armManualSession();

  if (hardRefresh && isRetailerProductUrl(location.href)) {
    startRetailerAutoResume(session.channelId!, location.href);
    publishUiState("Scheduled start — hard refreshing…", true);
    void requestHardReload();
    return;
  }

  publishUiState("Starting auto mode…", true);
  scheduleAutomationRun(runAutoMode);
}
