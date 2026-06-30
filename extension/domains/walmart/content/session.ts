import { RecordingBatcher } from "@ext/domains/walmart/content/recorder/batching.ts";
import { startWalmartRecorder } from "@ext/domains/walmart/content/recorder/index.ts";
import { WALMART_SESSION_STORAGE_KEY } from "@ext/domains/walmart/lib/constants.ts";
import {
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
  sendToBackground,
} from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, BackgroundToContent } from "@ext/core/types/index.ts";
import type { MarkerLabel } from "@ext/domains/walmart/types/walmart.ts";

let recorder: Awaited<ReturnType<typeof startWalmartRecorder>> | null = null;
const batcher = new RecordingBatcher();

function endSession(): void {
  try {
    sessionStorage.removeItem(WALMART_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function handleStart(
  sessionId: string,
  tabId: number,
  joinMode: "primary" | "late",
  reattach = false,
): Promise<void> {
  sessionStorage.setItem(WALMART_SESSION_STORAGE_KEY, sessionId);
  recorder = await startWalmartRecorder(sessionId, batcher, {
    tabId,
    skipSessionStart: joinMode === "late" || reattach,
    emitTabJoin: joinMode === "late" && !reattach,
  });
}

async function handleStop(): Promise<void> {
  await recorder?.stop();
  recorder = null;
  endSession();
}

chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
  if (!isExtensionContextValid()) {
    return;
  }
  void (async () => {
    try {
      if (message.type === "WALMART_RECORDING_START") {
        await handleStart(message.sessionId, message.tabId, message.joinMode);
      } else if (message.type === "WALMART_RECORDING_STOP") {
        await handleStop();
      } else if (message.type === "WALMART_RECORDING_MARK") {
        recorder?.mark(message.label as MarkerLabel);
      }
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        endSession();
      }
    }
  })();
});

function bootstrap(): void {
  if (!isExtensionContextValid()) {
    return;
  }
  const stored = sessionStorage.getItem(WALMART_SESSION_STORAGE_KEY);
  if (!stored) {
    return;
  }
  void sendToBackground<BackgroundResponse>({ type: "WALMART_RECORDING_REATTACH", sessionId: stored })
    .then((response) => {
      if ("ok" in response && response.ok && "tabId" in response) {
        return handleStart(stored, response.tabId, "late", true);
      }
    })
    .catch(() => {
      if (!isExtensionContextValid()) {
        endSession();
      }
    });
}

bootstrap();
