import type { GeneratedDescriptor } from "@ext/lib/retailer/element-descriptor.ts";
import {
  descriptorToProfile,
  startRecording,
} from "@ext/content/retailer/automation/record.ts";
import {
  resolveAutomationSteps,
  runAutomationPlayback,
} from "@ext/content/retailer/automation/playback.ts";
import {
  isManualUiMounted,
  mountManualUi,
  setManualUiStatus,
  unmountManualUi,
} from "@ext/content/retailer/manual-ui.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
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

async function loadProfileSteps() {
  const response = (await sendToBackground({ type: "RETAILER_RECORDING_GET" })) as {
    ok?: boolean;
    profile?: { steps: import("@ext/types/retailer.ts").AutomationStep[] } | null;
  };
  if (response?.ok === true && response.profile?.steps) {
    return response.profile.steps;
  }
  return undefined;
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

async function runAutoMode(): Promise<void> {
  if (session.running || bootstrapActive) {
    return;
  }
  if (!isRetailerProductUrl(location.href)) {
    setManualUiStatus("Open a product page (/p/…)");
    return;
  }

  session.running = true;
  setManualUiStatus("Running auto mode…");

  const profileSteps = await loadProfileSteps();
  const steps = resolveAutomationSteps(profileSteps);
  const result = await runAutomationPlayback(steps, setManualUiStatus);

  session.running = false;

  if (result.ok) {
    setManualUiStatus("Success");
    await reportAutoStatus("success");
  } else {
    setManualUiStatus(`Error: ${result.error}`);
    await reportAutoStatus("failed", result.error);
  }
}

function ensureManualUi(): void {
  if (!session.armed || isManualUiMounted()) {
    if (session.armed && !isManualUiMounted()) {
      mountManualUi({
        onStartAuto: () => void runAutoMode(),
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
      });
    }
    return;
  }

  mountManualUi({
    onStartAuto: () => void runAutoMode(),
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
  });
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

export function startRetailerSession(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  session.armed = true;
  session.channelId = "manual";
  session.url = location.href;
  ensureManualUi();
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
      default:
        return undefined;
    }
  });
}
