import {
  getRetailerTabChannel,
  releaseRetailerJob,
} from "@ext/background/retailer-runtime-state.ts";
import {
  getRetailerProfiles,
  prependHistory,
  saveRetailerProfile,
} from "@ext/lib/storage.ts";
import type { BackgroundResponse, RetailerToBackground } from "@ext/types/index.ts";

export async function handleRetailerMessage(
  message: RetailerToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab!.id!;

  switch (message.type) {
    case "RETAILER_PING":
      return { ok: true };
    case "RETAILER_RECORDING_GET": {
      const profiles = await getRetailerProfiles();
      return { ok: true, profile: profiles.target };
    }
    case "RETAILER_RECORDING_SAVE": {
      await saveRetailerProfile(message.profile);
      return { ok: true };
    }
    case "RETAILER_AUTO_STATUS": {
      if (message.channel_id !== "manual") {
        const boundChannel = getRetailerTabChannel(tabId);
        if (!boundChannel || boundChannel !== message.channel_id) {
          return { ok: false, error: "Invalid channel binding" };
        }
      }

      const now = new Date().toISOString();
      await prependHistory([
        {
          kind:
            message.status === "success" ? "retailer_auto_success" : "retailer_auto_failed",
          url: message.url,
          author: "retailer-auto",
          channel_id: message.channel_id,
          timestamp: now,
          error: message.error,
        },
      ]);

      releaseRetailerJob(message.channel_id);
      return { ok: true };
    }
  }
}
