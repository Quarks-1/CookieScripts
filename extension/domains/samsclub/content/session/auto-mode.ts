import { runAutomationPlayback } from "@ext/domains/samsclub/content/automation/playback.ts";
import type { SamsclubAutoConfig } from "@ext/domains/samsclub/content/automation/checkout-auto.ts";
import { probeAddToCartViaApi } from "@ext/domains/samsclub/lib/cart-api.ts";
import { waitingForAddToCartStatus } from "@ext/domains/samsclub/lib/restock-wait.ts";
import {
  parseTargetTcinFromUrl,
  waitForMainAddToCartButton,
  type WaitForAtcResult,
} from "@ext/domains/samsclub/lib/main-add-to-cart.ts";
import {
  clearSamsclubAutoResume,
  clearSamsclubAutoUserStopped,
  ensureSamsclubAutoResume,
  isSamsclubAutoUserStopped,
  markSamsclubAutoUserStopped,
  readSamsclubAutoResume,
  shouldResumeSamsclubAuto,
  startSamsclubAutoResume,
  transitionSamsclubAutoResumeToCheckout,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import { samsclubCheckoutDebug } from "@ext/domains/samsclub/lib/checkout/debug-log.ts";
import {
  isCheckoutAutomationUrl,
  isOrderConfirmationUrl,
  readySamsclubAutoModeMessage,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";
import { ensurePageCartProbeBridge } from "@ext/domains/samsclub/lib/page-cart-probe-bridge.ts";
import { defaultSamsclubAutomationSteps } from "@ext/domains/samsclub/lib/playback-engine.ts";
import {
  isEffectiveUseMax,
  isQuantityInvalid,
  readPurchaseLimitForAutomation,
  readPurchaseLimitFromNextData,
  resolveEffectiveQuantity,
} from "@ext/domains/samsclub/lib/quantity-limit.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/domains/samsclub/lib/selectors.ts";
import { isExtensionContextInvalidatedError, isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import { scheduleCheckoutAutoModeRun } from "@ext/domains/samsclub/content/session/checkout-schedule.ts";
import { syncTransitThrottleWatch } from "@ext/domains/samsclub/content/session/transit-wait.ts";
import {
  publishUiState,
  reportAutoStatus,
  sendToBackground,
  syncManualAutoStartToBackground,
  syncManualAutoStopToBackground,
} from "@ext/domains/samsclub/content/session/messaging.ts";
import { scheduleAutomationRun } from "@ext/domains/samsclub/content/session/schedule.ts";
import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";

export type StartAutoMessage = Extract<BackgroundToContent, { type: "SAMSCLUB_START_AUTO" }>;

export function requestStopAutoMode(): void {
  state.stopAutoRequested = true;
  state.automationScheduled = false;
  markSamsclubAutoUserStopped();
  syncManualAutoStopToBackground();
  session.syncGeneration += 1;
  session.running = false;
}

function allowAutoModeStart(): void {
  state.stopAutoRequested = false;
  clearSamsclubAutoUserStopped();
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

export async function loadAutoConfig(channelId: string): Promise<SamsclubAutoConfig> {
  const defaults: SamsclubAutoConfig = {
    refreshIntervalSec: 0,
    frontendAtcEnabled: true,
    backendAtcEnabled: false,
    atcQuantity: 1,
    useMaxQuantity: false,
    autoCheckoutEnabled: false,
    checkoutCvv: null,
    stopOnOosEnabled: false,
  };
  if (!isExtensionContextValid()) {
    endSession();
    return defaults;
  }
  try {
    const response = (await sendToBackground({
      type: "SAMSCLUB_GET_AUTO_CONFIG",
      channel_id: channelId,
    })) as {
      ok?: boolean;
      refresh_interval_sec?: number;
      frontend_atc_enabled?: boolean;
      backend_atc_enabled?: boolean;
      atc_quantity?: number;
      use_max_quantity?: boolean;
      auto_checkout_enabled?: boolean;
      checkout_cvv?: string | null;
      stop_on_oos_enabled?: boolean;
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
      checkoutCvv:
        response?.ok === true && typeof response.checkout_cvv === "string"
          ? response.checkout_cvv
          : null,
      stopOnOosEnabled: response?.ok === true && response.stop_on_oos_enabled === true,
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
  clearSamsclubAutoResume();
  session.running = false;
  return true;
}

export function syncCartProbeBridge(): void {
  if (!isExtensionContextValid() || state.sessionEnded) {
    return;
  }
  if (state.cachedBackendAtcEnabled && isSamsclubProductUrl(location.href)) {
    void ensurePageCartProbeBridge(document).catch(() => {
      // Bridge injection can fail after extension reload; auto mode handles probe fallback.
    });
  }
}

async function warmCartProbeBridge(): Promise<void> {
  if (state.cachedBackendAtcEnabled && isSamsclubProductUrl(location.href)) {
    await ensurePageCartProbeBridge(document);
  }
}

async function requestHardReload(): Promise<void> {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  try {
    await sendToBackground({ type: "SAMSCLUB_HARD_RELOAD" });
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
): import("@ext/domains/samsclub/content/automation/playback.ts").AutomationPlaybackOptions {
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
      if (session.channelId) {
        transitionSamsclubAutoResumeToCheckout(
          session.channelId,
          location.href,
          state.cachedAutoCheckoutEnabled,
        );
        syncTransitThrottleWatch(() => state.cachedRefreshIntervalSec);
      }
    },
  };
}

function handleSamsclubOosConfirmed(): void {
  if (!state.cachedStopOnOosEnabled) {
    return;
  }
  state.stoppedDueToOos = true;
  requestStopAutoMode();
  publishUiState("Stopped — out of stock", false);
}

export async function runAutoMode(): Promise<void> {
  state.automationScheduled = false;
  state.stoppedDueToOos = false;
  if (session.running || state.stopAutoRequested || isSamsclubAutoUserStopped()) {
    return;
  }
  if (!isSamsclubProductUrl(location.href)) {
    publishUiState("Open a product page (/ip/…)", false);
    return;
  }

  if (!session.channelId) {
    publishUiState("Ready — open a product page and press Start", false);
    return;
  }

  const config = state.autoConfigPrefetched
    ? {
        refreshIntervalSec: state.cachedRefreshIntervalSec,
        frontendAtcEnabled: state.cachedFrontendAtcEnabled,
        backendAtcEnabled: state.cachedBackendAtcEnabled,
        atcQuantity: state.cachedAtcQuantity,
        useMaxQuantity: state.cachedUseMaxQuantity,
        autoCheckoutEnabled: state.cachedAutoCheckoutEnabled,
        checkoutCvv: state.cachedCheckoutCvv,
        stopOnOosEnabled: state.cachedStopOnOosEnabled,
      }
    : await loadAutoConfig(session.channelId);
  state.autoConfigPrefetched = false;
  applyCachedAutoConfig(config);

  session.running = true;
  publishUiState("Running auto mode…", true);

  let skipReadyInFinally = false;

  try {
    const resuming = shouldResumeSamsclubAuto(location.href) !== null;
    if (resuming) {
      ensureSamsclubAutoResume(session.channelId, location.href);
    } else {
      startSamsclubAutoResume(session.channelId, location.href);
    }

    await warmCartProbeBridge();

    if (!state.cachedFrontendAtcEnabled && !state.cachedBackendAtcEnabled) {
      publishUiState("Error: Enable Frontend ATC or Backend ATC", false);
      await reportAutoStatus("failed", "Enable Frontend ATC or Backend ATC");
      clearSamsclubAutoResume();
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
      publishUiState(waitingForAddToCartStatus(document, location.href), true);
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
        onOosConfirmed: handleSamsclubOosConfirmed,
      });
    }
    if (!waitResult) {
      if (state.stopAutoRequested) {
        if (!state.stoppedDueToOos) {
          publishUiState("Stopped", false);
        }
        await reportAutoStatus("failed", state.stoppedDueToOos ? "Out of stock" : "Stopped");
        skipReadyInFinally = true;
        return;
      }
      if (readSamsclubAutoResume()) {
        return;
      }
      publishUiState("Error: Add to cart button not found", false);
      await reportAutoStatus("failed", "Add to cart button not found");
      clearSamsclubAutoResume();
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
    const steps = defaultSamsclubAutomationSteps(effectiveQuantity);

    const result = await runAutomationPlayback(
      steps,
      (text) => publishUiState(text, true),
      autoModePlaybackOptions(getRefreshIntervalSec, getEffectiveQuantity, cartAlreadyAddedFromWait),
    );

    if (!result.ok && result.error === "Reloading") {
      return;
    }

    if (result.ok) {
      // Checkout bridge takes over on the next page; release PDP running lock.
      skipReadyInFinally = true;
      session.running = false;
      return;
    }

    clearSamsclubAutoResume();

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
    session.running = false;
    if (!state.sessionEnded && !readSamsclubAutoResume() && !skipReadyInFinally) {
      publishUiState(readySamsclubAutoModeMessage(location.href), false);
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
  session.running = false;

  if (hardRefresh && isSamsclubProductUrl(location.href)) {
    startSamsclubAutoResume(session.channelId!, location.href);
    publishUiState("Scheduled start — hard refreshing…", true);
    void requestHardReload();
    return;
  }

  publishUiState("Starting auto mode…", true);

  if (isCheckoutAutomationUrl(location.href) && !isOrderConfirmationUrl(location.href)) {
    void loadAutoConfig("manual")
      .then((config) => {
        applyCachedAutoConfig(config);
        samsclubCheckoutDebug("auto-mode", "manual start on checkout", {
          autoCheckoutEnabled: config.autoCheckoutEnabled,
          hasCheckoutCvv: config.checkoutCvv != null,
          refreshIntervalSec: config.refreshIntervalSec,
        });
        if (!config.autoCheckoutEnabled) {
          publishUiState("Enable Auto checkout in side panel", false);
          return;
        }
        transitionSamsclubAutoResumeToCheckout("manual", location.href, true);
        scheduleCheckoutAutoModeRun();
      })
      .catch((err) => {
        if (isExtensionContextInvalidatedError(err)) {
          endSession();
          return;
        }
        publishUiState("Failed to start checkout", false);
      });
    return;
  }

  scheduleAutomationRun(runAutoMode);
}
