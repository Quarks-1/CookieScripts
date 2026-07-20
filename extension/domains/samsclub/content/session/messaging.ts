import {
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
} from "@ext/core/lib/messages.ts";
import type { SamsclubToBackground } from "@ext/core/types/index.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import { session } from "@ext/domains/samsclub/content/session/session-state.ts";

export function sendToBackground(message: SamsclubToBackground): Promise<unknown> {
  if (!isExtensionContextValid()) {
    return Promise.reject(new Error("Extension context invalidated."));
  }
  try {
    return chrome.runtime.sendMessage(message);
  } catch (error) {
    return Promise.reject(error);
  }
}

export function publishUiState(status: string, running?: boolean): void {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  void sendToBackground({
    type: "SAMSCLUB_UI_STATE",
    status,
    running: running ?? session.running,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export function syncManualAutoStopToBackground(): void {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  void sendToBackground({ type: "SAMSCLUB_SYNC_MANUAL_STOP" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export function syncManualAutoStartToBackground(): void {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  void sendToBackground({ type: "SAMSCLUB_SYNC_MANUAL_START" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export async function getTabAutoStateFromBackground(): Promise<{
  manualAutoStopped: boolean;
  running: boolean;
}> {
  if (!isExtensionContextValid()) {
    endSession();
    return { manualAutoStopped: false, running: false };
  }
  try {
    const response = (await sendToBackground({
      type: "SAMSCLUB_GET_TAB_AUTO_STATE",
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

export async function reportAutoStatus(
  status: "success" | "failed",
  error?: string,
): Promise<void> {
  if (!session.channelId || !isExtensionContextValid()) {
    if (!isExtensionContextValid()) {
      endSession();
    }
    return;
  }
  try {
    await sendToBackground({
      type: "SAMSCLUB_AUTO_STATUS",
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
