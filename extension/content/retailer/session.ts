import { runAutomationPlayback } from "@ext/content/retailer/automation/playback.ts";
import {
  runCheckoutAutoMode as runCheckoutAutoModeLoop,
  type RetailerAutoConfig,
} from "@ext/content/retailer/automation/checkout-auto.ts";
import { hookSpaNavigation } from "@ext/content/navigation.ts";
import { probeAddToCartViaApi } from "@ext/lib/retailer/cart-api.ts";
import {
  parseTargetTcinFromUrl,
  waitForMainAddToCartButton,
  type WaitForAtcResult,
} from "@ext/lib/retailer/main-add-to-cart.ts";
import {
  clearRetailerAutoUserStopped,
  clearRetailerAutoResume,
  ensureRetailerAutoResume,
  isRetailerAutoUserStopped,
  markRetailerAutoUserStopped,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  shouldResumeRetailerCheckout,
  startRetailerAutoResume,
  transitionRetailerAutoResumeToCheckout,
} from "@ext/lib/retailer/auto-resume.ts";
import { isCheckoutAutomationUrl, isOrderConfirmationUrl } from "@ext/lib/retailer/checkout/checkout-url.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
import { ensurePageCartProbeBridge } from "@ext/lib/retailer/page-cart-probe-bridge.ts";
import { defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";
import { takePendingStartAuto } from "@ext/lib/retailer/pending-start-auto.ts";
import {
  clearPageQuantityApplied,
  isEffectiveUseMax,
  isQuantityInvalid,
  readPurchaseLimitForAutomation,
  readPurchaseLimitForStatus,
  readPurchaseLimitFromNextData,
  resolveEffectiveQuantity,
} from "@ext/lib/retailer/quantity-limit.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/lib/retailer/selectors.ts";
import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";
import {
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
} from "@ext/lib/messages.ts";
import type { BackgroundToContent, RetailerToBackground } from "@ext/types/index.ts";

declare global {
  interface Window {
    __cookiescriptsRetailerSessionReady?: boolean;
  }
}

type Session = {
  channelId: string | null;
  url: string | null;
  syncGeneration: number;
  running: boolean;
};

const session: Session = {
  channelId: null,
  url: null,
  syncGeneration: 0,
  running: false,
};

let syncChain: Promise<void> = Promise.resolve();
let sessionEnded = false;
let automationScheduled = false;
let autoConfigPrefetched = false;
let stopAutoRequested = false;
let cachedRefreshIntervalSec = 0;
let cachedFrontendAtcEnabled = true;
let cachedBackendAtcEnabled = false;
let cachedAtcQuantity = 1;
let cachedUseMaxQuantity = false;
let cachedAutoCheckoutEnabled = false;
let trackedPurchaseLimitHref = location.href;
let unhookRetailerNavigation: (() => void) | null = null;
let purchaseLimitWatchTeardown: (() => void) | null = null;
let unhookPurchaseLimitPageShow: (() => void) | null = null;

const PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS = [500, 2_000, 4_000, 8_000] as const;
const PURCHASE_LIMIT_WATCH_DEBOUNCE_MS = 150;
let checkoutAbandonHandled = false;

function requestStopAutoMode(): void {
  stopAutoRequested = true;
  automationScheduled = false;
  markRetailerAutoUserStopped();
  syncManualAutoStopToBackground();
  session.syncGeneration += 1;
  session.running = false;
}

function allowAutoModeStart(): void {
  stopAutoRequested = false;
  clearRetailerAutoUserStopped();
  syncManualAutoStartToBackground();
}

function shouldContinueAutoMode(): boolean {
  return (
    session.running &&
    !stopAutoRequested &&
    !sessionEnded &&
    isExtensionContextValid()
  );
}

function isRetailerAutoDisabledInSettings(settings: ExtensionSettings): boolean {
  if (!settings.enabled) {
    return true;
  }
  if (!session.channelId || session.channelId === "manual") {
    return false;
  }
  const target = settings.channel_targets.find((row) => row.channel_id === session.channelId);
  return target?.retailer_auto_atc_enabled !== true;
}

function isCheckoutDisabledInSettings(settings: ExtensionSettings): boolean {
  return settings.retailer_auto_checkout_enabled !== true;
}

function applyCachedAutoConfig(config: RetailerAutoConfig): void {
  cachedRefreshIntervalSec = config.refreshIntervalSec;
  cachedFrontendAtcEnabled = config.frontendAtcEnabled;
  cachedBackendAtcEnabled = config.backendAtcEnabled;
  cachedAtcQuantity = config.atcQuantity;
  cachedUseMaxQuantity = config.useMaxQuantity;
  cachedAutoCheckoutEnabled = config.autoCheckoutEnabled;
}

function publishUiState(status: string, running?: boolean): void {
  void sendToBackground({
    type: "RETAILER_UI_STATE",
    status,
    running: running ?? session.running,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

function syncManualAutoStopToBackground(): void {
  void sendToBackground({ type: "RETAILER_SYNC_MANUAL_STOP" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

function syncManualAutoStartToBackground(): void {
  void sendToBackground({ type: "RETAILER_SYNC_MANUAL_START" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

async function getTabAutoStateFromBackground(): Promise<{
  manualAutoStopped: boolean;
  running: boolean;
}> {
  try {
    const response = (await sendToBackground({
      type: "RETAILER_GET_TAB_AUTO_STATE",
    })) as { ok?: boolean; manual_auto_stopped?: boolean; ui_running?: boolean };
    if (response?.ok !== true) {
      return { manualAutoStopped: false, running: false };
    }
    return {
      manualAutoStopped: response.manual_auto_stopped === true,
      running: response.ui_running === true,
    };
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
    return { manualAutoStopped: false, running: false };
  }
}

function watchSettings(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    const settingsChange = changes[STORAGE_KEYS.settings];
    if (settingsChange?.newValue && typeof settingsChange.newValue === "object") {
      const settings = settingsChange.newValue as ExtensionSettings;
      if (session.running) {
        if (isRetailerAutoDisabledInSettings(settings)) {
          requestStopAutoMode();
        } else if (
          readRetailerAutoResume()?.phase === "checkout" &&
          isCheckoutDisabledInSettings(settings)
        ) {
          requestStopAutoMode();
        }
      }
      if (session.channelId) {
        void loadAutoConfig(session.channelId).then((config) => {
          applyCachedAutoConfig(config);
          syncCartProbeBridge();
        });
      }
    }
  });
}

function endSession(): void {
  if (sessionEnded) {
    return;
  }
  sessionEnded = true;
  unhookRetailerNavigation?.();
  unhookRetailerNavigation = null;
  unhookPurchaseLimitPageShow?.();
  teardownPurchaseLimitWatch();
  session.channelId = null;
  session.url = null;
  session.running = false;
}

function sendToBackground(message: RetailerToBackground): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

function publishPurchaseLimitSnapshot(allowNull = false): void {
  if (!isRetailerProductUrl(location.href)) {
    return;
  }

  const purchaseLimit = readPurchaseLimitForStatus(document);
  if (purchaseLimit == null && !allowNull) {
    return;
  }

  void sendToBackground({
    type: "RETAILER_PURCHASE_LIMIT_SNAPSHOT",
    purchase_limit: purchaseLimit,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

function resetPurchaseLimitSnapshot(): void {
  void sendToBackground({
    type: "RETAILER_PURCHASE_LIMIT_SNAPSHOT",
    purchase_limit: null,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

function schedulePurchaseLimitSnapshots(): void {
  publishPurchaseLimitSnapshot();
  for (const delayMs of PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS) {
    globalThis.setTimeout(() => publishPurchaseLimitSnapshot(), delayMs);
  }
  globalThis.setTimeout(() => publishPurchaseLimitSnapshot(true), 12_000);
}

function teardownPurchaseLimitWatch(): void {
  purchaseLimitWatchTeardown?.();
  purchaseLimitWatchTeardown = null;
}

function armPurchaseLimitWatch(): void {
  teardownPurchaseLimitWatch();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSnapshot = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = globalThis.setTimeout(() => {
      debounceTimer = null;
      publishPurchaseLimitSnapshot();
    }, PURCHASE_LIMIT_WATCH_DEBOUNCE_MS);
  };

  const observers: MutationObserver[] = [];
  const observe = (target: Node, options: MutationObserverInit) => {
    const observer = new MutationObserver(() => scheduleSnapshot());
    observer.observe(target, options);
    observers.push(observer);
  };

  const nextData = document.getElementById("__NEXT_DATA__");
  if (nextData) {
    observe(nextData, { childList: true, characterData: true, subtree: true });
  } else if (document.head) {
    observe(document.head, { childList: true, subtree: false });
  }

  purchaseLimitWatchTeardown = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    for (const observer of observers) {
      observer.disconnect();
    }
    purchaseLimitWatchTeardown = null;
  };
}

function refreshPurchaseLimitForPage(force = false): void {
  if (sessionEnded || !isExtensionContextValid()) {
    endSession();
    return;
  }

  const href = location.href;
  if (!force && href === trackedPurchaseLimitHref) {
    return;
  }
  trackedPurchaseLimitHref = href;

  clearPageQuantityApplied();
  teardownPurchaseLimitWatch();
  resetPurchaseLimitSnapshot();

  if (isRetailerProductUrl(href)) {
    schedulePurchaseLimitSnapshots();
    armPurchaseLimitWatch();
  }
}

function handleRetailerNavigation(): void {
  refreshPurchaseLimitForPage(false);
  maybeFailCheckoutAbandon();
}

async function handleCheckoutAbandoned(): Promise<void> {
  publishUiState("Left checkout", false);
  clearRetailerAutoResume();
  await reportAutoStatus("failed", "Left checkout");
  session.running = false;
}

function maybeFailCheckoutAbandon(): void {
  const resume = readRetailerAutoResume();
  if (!resume || resume.phase !== "checkout" || !resume.auto_checkout_enabled) {
    checkoutAbandonHandled = false;
    return;
  }
  if (isCheckoutAutomationUrl(location.href)) {
    checkoutAbandonHandled = false;
    return;
  }
  if (checkoutAbandonHandled) {
    return;
  }
  checkoutAbandonHandled = true;
  void handleCheckoutAbandoned();
}

function hookPurchaseLimitPageShow(): void {
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !isRetailerProductUrl(location.href)) {
      return;
    }
    refreshPurchaseLimitForPage(true);
  };
  window.addEventListener("pageshow", onPageShow);
  unhookPurchaseLimitPageShow = () => {
    window.removeEventListener("pageshow", onPageShow);
    unhookPurchaseLimitPageShow = null;
  };
}

async function reportAutoStatus(
  status: "success" | "failed",
  error?: string,
): Promise<void> {
  if (!session.channelId) {
    return;
  }
  try {
    await sendToBackground({
      type: "RETAILER_AUTO_STATUS",
      channel_id: session.channelId,
      status,
      url: location.href,
      error,
    });
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  }
}

async function completeCheckoutSuccess(): Promise<void> {
  publishUiState("Success", false);
  clearRetailerAutoResume();
  await reportAutoStatus("success");
}

async function loadAutoConfig(channelId: string): Promise<RetailerAutoConfig> {
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
  };
}

type StartAutoMessage = Extract<BackgroundToContent, { type: "RETAILER_START_AUTO" }>;

function applyStartAutoConfig(message: StartAutoMessage): boolean {
  if (typeof message.refresh_interval_sec !== "number") {
    return false;
  }

  cachedRefreshIntervalSec = message.refresh_interval_sec;
  cachedFrontendAtcEnabled = message.frontend_atc_enabled !== false;
  cachedBackendAtcEnabled = message.backend_atc_enabled === true;
  cachedAtcQuantity =
    typeof message.atc_quantity === "number"
      ? Math.max(1, Math.floor(message.atc_quantity))
      : 1;
  cachedUseMaxQuantity = message.use_max_quantity === true;
  cachedAutoCheckoutEnabled = message.auto_checkout_enabled === true;
  return true;
}

function getEffectiveQuantityFromPage(purchaseLimit: number | null): number {
  const effectiveUseMax = isEffectiveUseMax(cachedUseMaxQuantity, purchaseLimit);
  return resolveEffectiveQuantity({
    quantity: cachedAtcQuantity,
    useMaxQuantity: effectiveUseMax,
    purchaseLimit,
  });
}

function failQuantityGate(purchaseLimit: number | null): boolean {
  if (purchaseLimit == null) {
    return false;
  }

  const effectiveUseMax = isEffectiveUseMax(cachedUseMaxQuantity, purchaseLimit);
  if (!isQuantityInvalid(cachedAtcQuantity, purchaseLimit, effectiveUseMax)) {
    return false;
  }

  const message = `Quantity (${cachedAtcQuantity}) exceeds max (${purchaseLimit})`;
  publishUiState(message, false);
  void reportAutoStatus("failed", message);
  clearRetailerAutoResume();
  session.running = false;
  return true;
}

function syncCartProbeBridge(): void {
  if (cachedBackendAtcEnabled && isRetailerProductUrl(location.href)) {
    void ensurePageCartProbeBridge(document);
  }
}

async function warmCartProbeBridge(): Promise<void> {
  if (cachedBackendAtcEnabled && isRetailerProductUrl(location.href)) {
    await ensurePageCartProbeBridge(document);
  }
}

async function requestHardReload(): Promise<void> {
  await sendToBackground({ type: "RETAILER_HARD_RELOAD" });
}

function autoModePlaybackOptions(
  getRefreshIntervalSec: () => number,
  getEffectiveQuantity: () => number,
  cartAlreadyAdded = false,
): import("@ext/content/retailer/automation/playback.ts").AutomationPlaybackOptions {
  return {
    shouldContinue: shouldContinueAutoMode,
    refreshIntervalSec: getRefreshIntervalSec(),
    getRefreshIntervalSec,
    requestHardReload,
    frontendAtcEnabled: cachedFrontendAtcEnabled,
    backendAtcEnabled: cachedBackendAtcEnabled,
    cartAlreadyAdded,
    getEffectiveQuantity,
    onBeforeCheckoutNavigate: () => {
      if (cachedAutoCheckoutEnabled && session.channelId) {
        transitionRetailerAutoResumeToCheckout(session.channelId, location.href);
      }
    },
  };
}

async function runAutoMode(): Promise<void> {
  automationScheduled = false;
  if (session.running || stopAutoRequested || isRetailerAutoUserStopped()) {
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

    const config = autoConfigPrefetched
      ? {
          refreshIntervalSec: cachedRefreshIntervalSec,
          frontendAtcEnabled: cachedFrontendAtcEnabled,
          backendAtcEnabled: cachedBackendAtcEnabled,
          atcQuantity: cachedAtcQuantity,
          useMaxQuantity: cachedUseMaxQuantity,
          autoCheckoutEnabled: cachedAutoCheckoutEnabled,
        }
      : await loadAutoConfig(session.channelId);
    autoConfigPrefetched = false;
    applyCachedAutoConfig(config);
    await warmCartProbeBridge();

    if (!cachedFrontendAtcEnabled && !cachedBackendAtcEnabled) {
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

    const getRefreshIntervalSec = () => cachedRefreshIntervalSec;
    const getEffectiveQuantity = () =>
      getEffectiveQuantityFromPage(readPurchaseLimitForAutomation(document));

    const readySelectors = DEFAULT_ADD_TO_CART_SELECTORS;

    let cartAlreadyAdded = false;
    if (cachedBackendAtcEnabled) {
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
        refreshIntervalSec: cachedRefreshIntervalSec,
        getRefreshIntervalSec,
        requestHardReload,
        frontendAtcEnabled: cachedFrontendAtcEnabled,
        backendAtcEnabled: cachedBackendAtcEnabled,
        getEffectiveQuantity,
      });
    }
    if (!waitResult) {
      if (stopAutoRequested) {
        publishUiState("Stopped", false);
        await reportAutoStatus("failed", "Stopped");
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

    if (result.ok && cachedAutoCheckoutEnabled) {
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
    if (!sessionEnded && !readRetailerAutoResume() && !skipReadyInFinally) {
      publishUiState(
        isRetailerProductUrl(location.href)
          ? "Ready — press Start Auto Mode"
          : "Ready — open a product page and press Start",
        false,
      );
    }
  }
}

async function runCheckoutAutoMode(): Promise<void> {
  automationScheduled = false;
  if (session.running || stopAutoRequested || isRetailerAutoUserStopped()) {
    return;
  }

  const resume = shouldResumeRetailerCheckout(location.href);
  if (!resume) {
    return;
  }

  session.channelId = resume.channel_id;
  session.url = location.href;
  session.running = true;
  publishUiState("Completing checkout…", true);

  let skipReadyInFinally = false;
  let skipRunningResetInFinally = false;

  const checkoutCallbacks = {
    shouldContinue: shouldContinueAutoMode,
    isStopRequested: () => stopAutoRequested,
    getAutoCheckoutEnabled: () => cachedAutoCheckoutEnabled,
    getRefreshIntervalSec: () => cachedRefreshIntervalSec,
    publishUiState,
    requestHardReload,
    onSuccess: completeCheckoutSuccess,
    onFailed: async (error: string) => {
      publishUiState(`Error: ${error}`, false);
      clearRetailerAutoResume();
      await reportAutoStatus("failed", error);
      skipReadyInFinally = true;
    },
    onStopped: async () => {
      publishUiState("Stopped", false);
      clearRetailerAutoResume();
      await reportAutoStatus("failed", "Stopped");
      skipReadyInFinally = true;
    },
  };

  try {
    const config = await loadAutoConfig(resume.channel_id);
    applyCachedAutoConfig(config);

    if (!cachedAutoCheckoutEnabled) {
      await checkoutCallbacks.onStopped();
      return;
    }

    const outcome = await runCheckoutAutoModeLoop(checkoutCallbacks);

    switch (outcome) {
      case "success":
        skipRunningResetInFinally = true;
        skipReadyInFinally = true;
        break;
      case "reloading":
        skipRunningResetInFinally = true;
        break;
      case "stopped":
      case "checkout_disabled":
      case "auth_required":
        skipReadyInFinally = true;
        break;
      case "failed":
      case "abandoned":
        if (!skipReadyInFinally) {
          await checkoutCallbacks.onFailed(
            outcome === "abandoned" ? "Left checkout" : "Checkout automation failed",
          );
        }
        skipReadyInFinally = true;
        break;
    }
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
      return;
    }
    const message = err instanceof Error ? err.message : "Checkout automation failed";
    publishUiState(message, false);
    clearRetailerAutoResume();
    await reportAutoStatus("failed", message);
    skipReadyInFinally = true;
  } finally {
    if (!skipRunningResetInFinally) {
      session.running = false;
    }
    if (!sessionEnded && !readRetailerAutoResume() && !skipReadyInFinally) {
      publishUiState("Ready — open a product page and press Start", false);
    }
  }
}

function scheduleAutomationRun(runner: () => Promise<void>): void {
  automationScheduled = true;
  const generation = ++session.syncGeneration;
  syncChain = syncChain
    .then(async () => {
      if (generation !== session.syncGeneration) {
        return;
      }
      await runner();
    })
    .catch((err) => {
      if (generation === session.syncGeneration) {
        automationScheduled = false;
      }
      if (isExtensionContextInvalidatedError(err)) {
        endSession();
      }
    });
}

function scheduleCheckoutAutoModeRun(): void {
  scheduleAutomationRun(runCheckoutAutoMode);
}

function scheduleAutoModeRun(): void {
  scheduleAutomationRun(runAutoMode);
}

function armManualSession(): void {
  session.channelId = "manual";
  session.url = location.href;
}

function handleStartAuto(message: StartAutoMessage) {
  allowAutoModeStart();
  session.channelId = message.channel_id;
  session.url = message.url;
  autoConfigPrefetched = applyStartAutoConfig(message);
  void warmCartProbeBridge();
  publishUiState("Running auto mode…", true);
  scheduleAutoModeRun();
}

function handleStartManualAuto(): void {
  allowAutoModeStart();
  armManualSession();
  publishUiState("Starting auto mode…", true);
  scheduleAutoModeRun();
}

function tryResumeAutomation(): void {
  if (isRetailerAutoUserStopped()) {
    return;
  }

  const checkoutResume = shouldResumeRetailerCheckout(location.href);
  if (checkoutResume) {
    session.channelId = checkoutResume.channel_id;
    session.url = location.href;

    if (isOrderConfirmationUrl(location.href)) {
      void completeCheckoutSuccess();
      return;
    }

    publishUiState("Resuming checkout…", true);
    scheduleCheckoutAutoModeRun();
    return;
  }

  const pdpResume = shouldResumeRetailerAuto(location.href);
  if (!pdpResume || !isRetailerProductUrl(location.href)) {
    return;
  }

  session.channelId = pdpResume.channel_id;
  session.url = location.href;
  publishUiState("Resuming auto mode…", true);
  scheduleAutoModeRun();
}

export function startRetailerSession(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  if (isRetailerProductUrl(location.href)) {
    void loadAutoConfig("manual").then((config) => {
      applyCachedAutoConfig(config);
      syncCartProbeBridge();
    });
  } else {
    const checkoutResume = shouldResumeRetailerCheckout(location.href);
    if (checkoutResume) {
      void loadAutoConfig(checkoutResume.channel_id).then((config) => {
        applyCachedAutoConfig(config);
      });
    }
  }

  watchSettings();

  unhookRetailerNavigation = hookSpaNavigation(handleRetailerNavigation);
  hookPurchaseLimitPageShow();

  if (isRetailerProductUrl(location.href)) {
    schedulePurchaseLimitSnapshots();
    armPurchaseLimitWatch();
  }

  chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
    if (!isExtensionContextValid()) {
      endSession();
      return;
    }

    switch (message.type) {
      case "RETAILER_PING":
        return { ok: true };
      case "RETAILER_START_AUTO":
        handleStartAuto(message);
        return { ok: true };
      case "RETAILER_START_MANUAL_AUTO":
        handleStartManualAuto();
        return { ok: true };
      case "RETAILER_STOP_AUTO":
        requestStopAutoMode();
        publishUiState("Stopped", false);
        return { ok: true };
      case "RETAILER_GET_PURCHASE_LIMIT": {
        const purchaseLimit = readPurchaseLimitForStatus(document);
        return {
          ok: true as const,
          purchase_limit: purchaseLimit,
        };
      }
      default:
        return undefined;
    }
  });

  window.__cookiescriptsRetailerSessionReady = true;

  const pendingStartAuto = takePendingStartAuto();
  if (pendingStartAuto) {
    handleStartAuto(pendingStartAuto);
  }

  void initRetailerSession();
}

async function initRetailerSession(): Promise<void> {
  const tabState = await getTabAutoStateFromBackground();
  if (tabState.manualAutoStopped) {
    markRetailerAutoUserStopped();
    publishUiState("Stopped", false);
    return;
  }

  if (shouldResumeRetailerCheckout(location.href) || shouldResumeRetailerAuto(location.href)) {
    tryResumeAutomation();
    return;
  }

  if (tabState.running) {
    return;
  }

  if (isRetailerAutoUserStopped()) {
    publishUiState("Stopped", false);
  } else if (!automationScheduled && !session.running) {
    publishUiState(
      isRetailerProductUrl(location.href)
        ? "Ready — press Start Auto Mode"
        : "Ready — open a product page and press Start",
      false,
    );
  }
}
