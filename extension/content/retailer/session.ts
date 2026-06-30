import { runAutomationPlayback } from "@ext/content/retailer/automation/playback.ts";
import { hookSpaNavigation } from "@ext/content/navigation.ts";
import { waitForMainAddToCartButton } from "@ext/lib/retailer/main-add-to-cart.ts";
import {
  clearRetailerAutoUserStopped,
  clearRetailerAutoResume,
  ensureRetailerAutoResume,
  isRetailerAutoUserStopped,
  markRetailerAutoUserStopped,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  startRetailerAutoResume,
} from "@ext/lib/retailer/auto-resume.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
import { ensurePageCartProbeBridge } from "@ext/lib/retailer/page-cart-probe-bridge.ts";
import { defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";
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
import { sleep } from "@ext/lib/sleep.ts";
import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";
import {
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
} from "@ext/lib/messages.ts";
import type { BackgroundToContent, RetailerToBackground } from "@ext/types/index.ts";

const BOOTSTRAP_QUIET_MS = 500;

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
let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
let bootstrapActive = false;
let stopAutoRequested = false;
let cachedRefreshIntervalSec = 0;
let cachedFrontendAtcEnabled = true;
let cachedBackendAtcEnabled = false;
let cachedAtcQuantity = 1;
let cachedUseMaxQuantity = false;
let trackedPurchaseLimitHref = location.href;
let unhookRetailerNavigation: (() => void) | null = null;

function requestStopAutoMode(): void {
  stopAutoRequested = true;
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
  return target?.retailer_auto_enabled !== true;
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

async function isManualAutoStoppedInBackground(): Promise<boolean> {
  try {
    const response = (await sendToBackground({
      type: "RETAILER_GET_TAB_AUTO_STATE",
    })) as { ok?: boolean; manual_auto_stopped?: boolean };
    return response?.ok === true && response.manual_auto_stopped === true;
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
    return false;
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
      if (session.running && isRetailerAutoDisabledInSettings(settings)) {
        requestStopAutoMode();
      }
      if (session.channelId) {
        void loadAutoConfig(session.channelId).then((config) => {
          cachedRefreshIntervalSec = config.refreshIntervalSec;
          cachedFrontendAtcEnabled = config.frontendAtcEnabled;
          cachedBackendAtcEnabled = config.backendAtcEnabled;
          cachedAtcQuantity = config.atcQuantity;
          cachedUseMaxQuantity = config.useMaxQuantity;
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
  session.channelId = null;
  session.url = null;
  session.running = false;
}

function sendToBackground(message: RetailerToBackground): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

function publishPurchaseLimitSnapshot(): void {
  if (!isRetailerProductUrl(location.href)) {
    return;
  }

  const purchaseLimit = readPurchaseLimitForStatus(document);
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
  for (const delayMs of [500, 2_000, 4_000]) {
    globalThis.setTimeout(() => publishPurchaseLimitSnapshot(), delayMs);
  }
}

function handleRetailerNavigation(): void {
  if (sessionEnded || !isExtensionContextValid()) {
    endSession();
    return;
  }

  const href = location.href;
  if (href === trackedPurchaseLimitHref) {
    return;
  }
  trackedPurchaseLimitHref = href;

  clearPageQuantityApplied();
  resetPurchaseLimitSnapshot();

  if (isRetailerProductUrl(href)) {
    schedulePurchaseLimitSnapshots();
  }
}

async function reportAutoStatus(
  status: "success" | "failed",
  error?: string,
): Promise<void> {
  if (!session.channelId || !session.url) {
    return;
  }
  try {
    await sendToBackground({
      type: "RETAILER_AUTO_STATUS",
      channel_id: session.channelId,
      status,
      url: session.url,
      error,
    });
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  }
}

function beginBootstrapQuiet(): void {
  bootstrapActive = true;
  if (bootstrapTimer !== null) {
    clearTimeout(bootstrapTimer);
  }
  bootstrapTimer = setTimeout(() => {
    bootstrapTimer = null;
    bootstrapActive = false;
  }, BOOTSTRAP_QUIET_MS);
}

async function loadAutoConfig(channelId: string): Promise<{
  refreshIntervalSec: number;
  frontendAtcEnabled: boolean;
  backendAtcEnabled: boolean;
  atcQuantity: number;
  useMaxQuantity: boolean;
}> {
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
  };
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
  };
}

async function runAutoMode(): Promise<void> {
  if (session.running || bootstrapActive || stopAutoRequested || isRetailerAutoUserStopped()) {
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

  try {
    const resuming = shouldResumeRetailerAuto(location.href) !== null;
    if (resuming) {
      ensureRetailerAutoResume(session.channelId, location.href);
    } else {
      startRetailerAutoResume(session.channelId, location.href);
    }

    const config = await loadAutoConfig(session.channelId);
    cachedRefreshIntervalSec = config.refreshIntervalSec;
    cachedFrontendAtcEnabled = config.frontendAtcEnabled;
    cachedBackendAtcEnabled = config.backendAtcEnabled;
    cachedAtcQuantity = config.atcQuantity;
    cachedUseMaxQuantity = config.useMaxQuantity;
    syncCartProbeBridge();

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

    publishUiState("Waiting for product page…", true);
    const waitResult = await waitForMainAddToCartButton({
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

    const cartAlreadyAdded = waitResult.kind === "api_added";

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
      autoModePlaybackOptions(getRefreshIntervalSec, getEffectiveQuantity, cartAlreadyAdded),
    );

    if (!result.ok && result.error === "Reloading") {
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
    session.running = false;
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

function scheduleAutoModeRun(): void {
  beginBootstrapQuiet();
  const generation = ++session.syncGeneration;
  syncChain = syncChain
    .then(async () => {
      if (generation !== session.syncGeneration) {
        return;
      }
      await sleep(BOOTSTRAP_QUIET_MS);
      if (generation !== session.syncGeneration) {
        return;
      }
      await runAutoMode();
    })
    .catch((err) => {
      if (isExtensionContextInvalidatedError(err)) {
        endSession();
      }
    });
}

function armManualSession(): void {
  session.channelId = "manual";
  session.url = location.href;
}

function handleStartAuto(message: Extract<BackgroundToContent, { type: "RETAILER_START_AUTO" }>) {
  allowAutoModeStart();
  session.channelId = message.channel_id;
  session.url = message.url;
  scheduleAutoModeRun();
}

function handleStartManualAuto(): void {
  allowAutoModeStart();
  armManualSession();
  publishUiState("Starting auto mode…", true);
  scheduleAutoModeRun();
}

function tryResumeAutoMode(): void {
  if (isRetailerAutoUserStopped()) {
    return;
  }
  const resume = shouldResumeRetailerAuto(location.href);
  if (!resume || !isRetailerProductUrl(location.href)) {
    return;
  }

  session.channelId = resume.channel_id;
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
      cachedFrontendAtcEnabled = config.frontendAtcEnabled;
      cachedBackendAtcEnabled = config.backendAtcEnabled;
      cachedAtcQuantity = config.atcQuantity;
      cachedUseMaxQuantity = config.useMaxQuantity;
      syncCartProbeBridge();
    });
  }

  watchSettings();

  unhookRetailerNavigation = hookSpaNavigation(handleRetailerNavigation);

  if (isRetailerProductUrl(location.href)) {
    schedulePurchaseLimitSnapshots();
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

  void initRetailerSession();
}

async function initRetailerSession(): Promise<void> {
  armManualSession();

  if (await isManualAutoStoppedInBackground()) {
    markRetailerAutoUserStopped();
    publishUiState("Stopped", false);
    return;
  }

  if (shouldResumeRetailerAuto(location.href)) {
    tryResumeAutoMode();
  } else if (isRetailerAutoUserStopped()) {
    publishUiState("Stopped", false);
  } else {
    publishUiState(
      isRetailerProductUrl(location.href)
        ? "Ready — press Start Auto Mode"
        : "Ready — open a product page and press Start",
      false,
    );
  }
}
