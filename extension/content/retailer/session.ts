import type { GeneratedDescriptor } from "@ext/lib/retailer/element-descriptor.ts";
import {
  descriptorToProfile,
  startRecording,
} from "@ext/content/retailer/automation/record.ts";
import {
  resolvePlaybackSteps,
  runAutomationPlayback,
} from "@ext/content/retailer/automation/playback.ts";
import {
  getManualUiRefreshInterval,
  isManualUiMounted,
  mountManualUi,
  setManualUiRefreshInterval,
  setManualUiStatus,
  unmountManualUi,
} from "@ext/content/retailer/manual-ui.ts";
import { waitForMainAddToCartButton } from "@ext/lib/retailer/main-add-to-cart.ts";
import {
  clearRetailerAutoResume,
  ensureRetailerAutoResume,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  startRetailerAutoResume,
} from "@ext/lib/retailer/auto-resume.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/content/retailer/selectors.ts";
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
  armed: boolean;
  running: boolean;
};

const session: Session = {
  channelId: null,
  url: null,
  syncGeneration: 0,
  armed: false,
  running: false,
};

let syncChain: Promise<void> = Promise.resolve();
let sessionEnded = false;
let stopRecording: (() => void) | null = null;
const recordedDescriptors: GeneratedDescriptor[] = [];
let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
let bootstrapActive = false;
let stopAutoRequested = false;

function requestStopAutoMode(): void {
  stopAutoRequested = true;
  clearRetailerAutoResume();
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

function watchAutoModeSettings(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !session.running) {
      return;
    }
    const settingsChange = changes[STORAGE_KEYS.settings];
    if (!settingsChange?.newValue || typeof settingsChange.newValue !== "object") {
      return;
    }
    if (isRetailerAutoDisabledInSettings(settingsChange.newValue as ExtensionSettings)) {
      requestStopAutoMode();
    }
  });
}

function endSession(): void {
  if (sessionEnded) {
    return;
  }
  sessionEnded = true;
  stopRecording?.();
  stopRecording = null;
  unmountManualUi();
  session.channelId = null;
  session.url = null;
  session.armed = false;
  session.running = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendToBackground(message: RetailerToBackground): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

async function loadProfile(): Promise<import("@ext/types/retailer.ts").RetailerProfile | null> {
  const response = (await sendToBackground({ type: "RETAILER_RECORDING_GET" })) as {
    ok?: boolean;
    profile?: import("@ext/types/retailer.ts").RetailerProfile | null;
  };
  if (response?.ok === true && response.profile) {
    return response.profile;
  }
  return null;
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

async function loadAutoConfig(channelId: string): Promise<{ refreshIntervalSec: number }> {
  const response = (await sendToBackground({
    type: "RETAILER_GET_AUTO_CONFIG",
    channel_id: channelId,
  })) as { ok?: boolean; refresh_interval_sec?: number };
  return {
    refreshIntervalSec:
      response?.ok === true && typeof response.refresh_interval_sec === "number"
        ? response.refresh_interval_sec
        : 0,
  };
}

async function requestHardReload(): Promise<void> {
  await sendToBackground({ type: "RETAILER_HARD_RELOAD" });
}

async function resolveRefreshIntervalSec(channelId: string): Promise<number> {
  const fromUi = getManualUiRefreshInterval();
  const fromStorage = (await loadAutoConfig(channelId)).refreshIntervalSec;
  const interval = fromUi > 0 ? fromUi : fromStorage;
  if (fromUi > 0 && fromUi !== fromStorage) {
    await saveRefreshInterval(fromUi);
  }
  return interval;
}

function autoModePlaybackOptions(
  getRefreshIntervalSec: () => number,
): import("@ext/content/retailer/automation/playback.ts").AutomationPlaybackOptions {
  return {
    shouldContinue: shouldContinueAutoMode,
    refreshIntervalSec: getRefreshIntervalSec(),
    getRefreshIntervalSec,
    requestHardReload,
  };
}

async function runAutoMode(): Promise<void> {
  if (session.running || bootstrapActive) {
    return;
  }
  if (!isRetailerProductUrl(location.href)) {
    setManualUiStatus("Open a product page (/p/…)");
    return;
  }

  stopAutoRequested = false;
  session.running = true;
  setManualUiStatus("Running auto mode…");

  if (!session.channelId) {
    session.running = false;
    return;
  }

  const resuming = shouldResumeRetailerAuto(location.href) !== null;
  if (resuming) {
    ensureRetailerAutoResume(session.channelId, location.href);
  } else {
    startRetailerAutoResume(session.channelId, location.href);
  }

  const refreshIntervalSec = await resolveRefreshIntervalSec(session.channelId);
  const getRefreshIntervalSec = () => getManualUiRefreshInterval() || refreshIntervalSec;

  const profile = await loadProfile();
  const steps = resolvePlaybackSteps(profile);
  const readySelectors =
    steps.find((step) => step.type === "keyboard_enter_hold")?.selectors ??
    DEFAULT_ADD_TO_CART_SELECTORS;

  setManualUiStatus("Waiting for product page…");
  const ready = await waitForMainAddToCartButton({
    selectors: readySelectors,
    timeoutMs: null,
    shouldContinue: shouldContinueAutoMode,
    pageUrl: location.href,
    onStatus: setManualUiStatus,
    refreshIntervalSec,
    getRefreshIntervalSec,
    requestHardReload,
  });
  if (!ready) {
    session.running = false;
    if (stopAutoRequested) {
      setManualUiStatus("Stopped");
      await reportAutoStatus("failed", "Stopped");
      return;
    }
    if (readRetailerAutoResume()) {
      return;
    }
    setManualUiStatus("Error: Add to cart button not found");
    await reportAutoStatus("failed", "Add to cart button not found");
    clearRetailerAutoResume();
    return;
  }

  const result = await runAutomationPlayback(
    steps,
    setManualUiStatus,
    autoModePlaybackOptions(getRefreshIntervalSec),
  );

  session.running = false;
  clearRetailerAutoResume();

  if (result.ok) {
    setManualUiStatus("Success");
    await reportAutoStatus("success");
    return;
  }

  if (result.error === "Stopped") {
    setManualUiStatus("Stopped");
    await reportAutoStatus("failed", "Stopped");
    return;
  }

  if (result.error === "Reloading") {
    return;
  }

  setManualUiStatus(`Error: ${result.error}`);
  await reportAutoStatus("failed", result.error);
}

async function saveRefreshInterval(intervalSec: number): Promise<void> {
  const channelId = session.channelId ?? "manual";
  await sendToBackground({
    type: "RETAILER_SET_REFRESH_INTERVAL",
    channel_id: channelId,
    interval_sec: intervalSec,
  });
  setManualUiRefreshInterval(intervalSec);
}

async function syncManualUiRefreshInterval(): Promise<void> {
  const channelId = session.channelId ?? "manual";
  const config = await loadAutoConfig(channelId);
  setManualUiRefreshInterval(config.refreshIntervalSec);
}

function manualUiCallbacks(): import("@ext/content/retailer/manual-ui.ts").ManualUiCallbacks {
  return {
    onStartAuto: () => {
      void saveRefreshInterval(getManualUiRefreshInterval()).then(() => runAutoMode());
    },
    onStopAuto: () => {
      requestStopAutoMode();
      setManualUiStatus("Stopping…");
    },
    onRefreshIntervalChange: (intervalSec) => {
      void saveRefreshInterval(intervalSec);
    },
    onToggleRecord: () => {
      if (stopRecording) {
        stopRecording();
        stopRecording = null;
        setManualUiStatus("Record stopped");
        return;
      }
      stopRecording = startRecording((descriptor) => {
        recordedDescriptors.push(descriptor);
        setManualUiStatus(`Captured (${recordedDescriptors.length})`);
      });
      setManualUiStatus("Recording… click elements");
    },
    onSaveRecording: () => {
      void sendToBackground({
        type: "RETAILER_RECORDING_SAVE",
        profile: descriptorToProfile(recordedDescriptors),
      }).then(() => setManualUiStatus("Recording saved"));
    },
    onClearRecording: () => {
      recordedDescriptors.length = 0;
      setManualUiStatus("Recording cleared");
    },
  };
}

function ensureManualUi(): void {
  if (!session.armed) {
    return;
  }

  if (!isManualUiMounted()) {
    mountManualUi(manualUiCallbacks(), 0);
    void syncManualUiRefreshInterval();
  }
}

function handleStartAuto(message: Extract<BackgroundToContent, { type: "RETAILER_START_AUTO" }>) {
  session.channelId = message.channel_id;
  session.url = message.url;
  session.armed = true;
  beginBootstrapQuiet();
  ensureManualUi();

  const generation = ++session.syncGeneration;
  syncChain = syncChain.then(async () => {
    if (generation !== session.syncGeneration) {
      return;
    }
    await sleep(BOOTSTRAP_QUIET_MS);
    if (generation !== session.syncGeneration) {
      return;
    }
    await runAutoMode();
  });
}

function handleArmUi() {
  session.channelId = "manual";
  session.url = location.href;
  session.armed = true;
  ensureManualUi();
  setManualUiStatus("Armed — use Start Auto Mode on this product page");
}

function tryResumeAutoMode(): void {
  const resume = shouldResumeRetailerAuto(location.href);
  if (!resume || !isRetailerProductUrl(location.href)) {
    return;
  }

  session.channelId = resume.channel_id;
  session.url = location.href;
  session.armed = true;
  ensureManualUi();
  setManualUiStatus("Resuming auto mode…");

  const generation = ++session.syncGeneration;
  syncChain = syncChain.then(async () => {
    if (generation !== session.syncGeneration) {
      return;
    }
    await sleep(BOOTSTRAP_QUIET_MS);
    if (generation !== session.syncGeneration) {
      return;
    }
    await runAutoMode();
  });
}

export function startRetailerSession(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  watchAutoModeSettings();

  session.armed = true;
  session.channelId = "manual";
  session.url = location.href;
  ensureManualUi();

  if (shouldResumeRetailerAuto(location.href)) {
    tryResumeAutoMode();
    return;
  }

  setManualUiStatus("Ready — open a product page and use Start Auto Mode");

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
      case "RETAILER_ARM_UI":
        handleArmUi();
        return { ok: true };
      case "RETAILER_STOP_AUTO":
        requestStopAutoMode();
        setManualUiStatus("Stopping…");
        return { ok: true };
      default:
        return undefined;
    }
  });
}
