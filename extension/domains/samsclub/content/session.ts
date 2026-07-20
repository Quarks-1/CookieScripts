import { RecordingBatcher } from "@ext/domains/samsclub/content/recorder/batching.ts";
import { startSamsclubRecorder } from "@ext/domains/samsclub/content/recorder/index.ts";
import { SAMSCLUB_SESSION_STORAGE_KEY } from "@ext/domains/samsclub/lib/constants.ts";
import {
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
  sendToBackground,
} from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, BackgroundToContent } from "@ext/core/types/index.ts";
import type { MarkerLabel } from "@ext/domains/samsclub/types/samsclub.ts";

let recorder: Awaited<ReturnType<typeof startSamsclubRecorder>> | null = null;
const batcher = new RecordingBatcher();

function endSession(): void {
  try {
    sessionStorage.removeItem(SAMSCLUB_SESSION_STORAGE_KEY);
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
  sessionStorage.setItem(SAMSCLUB_SESSION_STORAGE_KEY, sessionId);
  recorder = await startSamsclubRecorder(sessionId, batcher, {
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
      if (message.type === "SAMSCLUB_RECORDING_START") {
        await handleStart(message.sessionId, message.tabId, message.joinMode);
      } else if (message.type === "SAMSCLUB_RECORDING_STOP") {
        await handleStop();
      } else if (message.type === "SAMSCLUB_RECORDING_MARK") {
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
  const stored = sessionStorage.getItem(SAMSCLUB_SESSION_STORAGE_KEY);
  if (!stored) {
    return;
  }
  void sendToBackground<BackgroundResponse>({ type: "SAMSCLUB_RECORDING_REATTACH", sessionId: stored })
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
