import type { GeneratedDescriptor } from "@ext/lib/retailer/element-descriptor.ts";
import {
  descriptorToProfile,
  startRecording,
} from "@ext/content/retailer/automation/record.ts";
import { runAutomationPlayback } from "@ext/content/retailer/automation/playback.ts";
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
import { resolveAutomationSteps } from "@ext/lib/retailer/resolve-steps.ts";
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
let stopRecording: (() => void) | null = null;
let recordingActive = false;
const recordedDescriptors: GeneratedDescriptor[] = [];
let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
let bootstrapActive = false;
let stopAutoRequested = false;
let cachedRefreshIntervalSec = 0;

function requestStopAutoMode(): void {
  stopAutoRequested = true;
  markRetailerAutoUserStopped();
  session.syncGeneration += 1;
  session.running = false;
}

function allowAutoModeStart(): void {
  stopAutoRequested = false;
  clearRetailerAutoUserStopped();
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
    recording: recordingActive,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
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
  stopRecording?.();
  stopRecording = null;
  recordingActive = false;
  session.channelId = null;
  session.url = null;
  session.running = false;
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

  try {
    const resuming = shouldResumeRetailerAuto(location.href) !== null;
    if (resuming) {
      ensureRetailerAutoResume(session.channelId, location.href);
    } else {
      startRetailerAutoResume(session.channelId, location.href);
    }

    cachedRefreshIntervalSec = (await loadAutoConfig(session.channelId)).refreshIntervalSec;
    const getRefreshIntervalSec = () => cachedRefreshIntervalSec;

    const profile = await loadProfile();
    const steps = resolveAutomationSteps(profile);
    const readySelectors =
      steps.find((step) => step.type === "keyboard_enter_hold")?.selectors ??
      DEFAULT_ADD_TO_CART_SELECTORS;

    publishUiState("Waiting for product page…", true);
    const ready = await waitForMainAddToCartButton({
      selectors: readySelectors,
      timeoutMs: null,
      shouldContinue: shouldContinueAutoMode,
      pageUrl: location.href,
      onStatus: (text) => publishUiState(text, true),
      refreshIntervalSec: cachedRefreshIntervalSec,
      getRefreshIntervalSec,
      requestHardReload,
    });
    if (!ready) {
      if (stopAutoRequested) {
        publishUiState("Stopped", false);
        await reportAutoStatus("failed", "Stopped");
        return;
      }
      if (readRetailerAutoResume()) {
        return;
      }
      publishUiState("Error: Add to cart button not found", false);
      await reportAutoStatus("failed", "Add to cart button not found");
      clearRetailerAutoResume();
      return;
    }

    const result = await runAutomationPlayback(
      steps,
      (text) => publishUiState(text, true),
      autoModePlaybackOptions(getRefreshIntervalSec),
    );

    clearRetailerAutoResume();

    if (result.ok) {
      publishUiState("Success", false);
      await reportAutoStatus("success");
      return;
    }

    if (result.error === "Stopped") {
      publishUiState("Stopped", false);
      await reportAutoStatus("failed", "Stopped");
      return;
    }

    if (result.error === "Reloading") {
      return;
    }

    publishUiState(`Error: ${result.error}`, false);
    await reportAutoStatus("failed", result.error);
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
      return;
    }
    publishUiState(err instanceof Error ? err.message : "Auto mode failed", false);
  } finally {
    session.running = false;
    if (!sessionEnded && !readRetailerAutoResume()) {
      publishUiState(
        isRetailerProductUrl(location.href)
          ? "Ready — press Start Auto Mode"
          : "Ready — open a product page and press Start",
        false,
      );
    }
  }
}

function toggleRecording(): void {
  if (stopRecording) {
    stopRecording();
    stopRecording = null;
    recordingActive = false;
    publishUiState("Record stopped");
    return;
  }
  stopRecording = startRecording((descriptor) => {
    recordedDescriptors.push(descriptor);
    publishUiState(`Recording… captured ${recordedDescriptors.length} step(s)`);
  });
  recordingActive = true;
  publishUiState("Recording… click elements on the page");
}

async function saveRecording(): Promise<void> {
  await sendToBackground({
    type: "RETAILER_RECORDING_SAVE",
    profile: descriptorToProfile(recordedDescriptors),
  });
  publishUiState("Recording saved");
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

  watchSettings();
  armManualSession();

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
      case "RETAILER_TOGGLE_RECORDING":
        toggleRecording();
        return { ok: true };
      case "RETAILER_SAVE_RECORDING":
        void saveRecording();
        return { ok: true };
      default:
        return undefined;
    }
  });
}
