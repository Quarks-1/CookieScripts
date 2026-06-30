import { isExtensionContextInvalidatedError } from "@ext/core/lib/messages.ts";
import type { RetailerToBackground } from "@ext/core/types/index.ts";
import { endSession } from "@ext/domains/target/content/session/lifecycle.ts";
import { session } from "@ext/domains/target/content/session/session-state.ts";

export function sendToBackground(message: RetailerToBackground): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function publishUiState(status: string, running?: boolean): void {
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

export function syncManualAutoStopToBackground(): void {
  void sendToBackground({ type: "RETAILER_SYNC_MANUAL_STOP" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export function syncManualAutoStartToBackground(): void {
  void sendToBackground({ type: "RETAILER_SYNC_MANUAL_START" }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export async function getTabAutoStateFromBackground(): Promise<{
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

export async function reportAutoStatus(
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
