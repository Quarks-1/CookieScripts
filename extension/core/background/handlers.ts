import { handleDiscordMessage } from "@ext/domains/discord/background/handlers.ts";
import { handleRetailerMessage } from "@ext/domains/target/background/handlers.ts";
import { handleUiMessage } from "@ext/core/background/ui-handlers.ts";
import {
  handleWalmartContentMessage,
} from "@ext/domains/walmart/background/handlers/index.ts";
import {
  isDiscordContentSender,
  isExtensionPageSender,
  isRetailerContentSender,
  isWalmartContentSender,
} from "@ext/core/background/sender-auth.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  RetailerToBackground,
  RuntimeMessage,
  UiToBackground,
  WalmartToBackground,
} from "@ext/core/types/index.ts";

function isDiscordContentMessage(
  message: RuntimeMessage,
): message is ContentToBackground {
  return (
    message.type === "CHANNEL_ACTIVE" ||
    message.type === "CHANNEL_INACTIVE" ||
    message.type === "CANDIDATE_LINKS" ||
    message.type === "ADD_ALLOWED_DOMAIN" ||
    message.type === "IGNORE_DOMAIN"
  );
}

function isRetailerContentMessage(message: RuntimeMessage): message is RetailerToBackground {
  return (
    message.type === "RETAILER_AUTO_STATUS" ||
    message.type === "RETAILER_GET_AUTO_CONFIG" ||
    message.type === "RETAILER_SET_REFRESH_INTERVAL" ||
    message.type === "RETAILER_HARD_RELOAD" ||
    message.type === "RETAILER_PING" ||
    message.type === "RETAILER_GET_TAB_AUTO_STATE" ||
    message.type === "RETAILER_SYNC_MANUAL_STOP" ||
    message.type === "RETAILER_SYNC_MANUAL_START" ||
    message.type === "RETAILER_UI_STATE" ||
    message.type === "RETAILER_PURCHASE_LIMIT_SNAPSHOT"
  );
}

function isWalmartContentMessage(message: RuntimeMessage): message is WalmartToBackground {
  return (
    message.type === "WALMART_RECORDING_APPEND" ||
    message.type === "WALMART_RECORDING_REATTACH" ||
    message.type === "WALMART_PING" ||
    message.type === "WALMART_GET_AUTO_REFRESH_CONFIG" ||
    message.type === "WALMART_SYNC_AUTO_REFRESH" ||
    message.type === "WALMART_HARD_RELOAD" ||
    message.type === "WALMART_QUEUE_PASS" ||
    message.type === "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST"
  );
}

function isUiMessage(message: RuntimeMessage): message is UiToBackground {
  return (
    message.type === "GET_STATUS" ||
    message.type === "GET_SETTINGS" ||
    message.type === "SAVE_SETTINGS" ||
    message.type === "GET_HISTORY" ||
    message.type === "CLEAR_HISTORY" ||
    message.type === "GET_DETECTED_DOMAINS" ||
    message.type === "SET_RETAILER_AUTO_ATC_ENABLED" ||
    message.type === "SET_RETAILER_REFRESH_INTERVAL" ||
    message.type === "SET_RETAILER_ATC_MODES" ||
    message.type === "SET_RETAILER_ATC_QUANTITY" ||
    message.type === "SET_RETAILER_AUTO_CHECKOUT_MODE" ||
    message.type === "RETAILER_START_MANUAL_AUTO" ||
    message.type === "RETAILER_STOP_MANUAL_AUTO" ||
    message.type === "WALMART_RECORDING" ||
    message.type === "SET_WALMART_AUTO_REFRESH_ENABLED" ||
    message.type === "SET_WALMART_REFRESH_INTERVAL"
  );
}

export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse | undefined> {
  try {
    if (isDiscordContentMessage(message)) {
      if (!isDiscordContentSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleDiscordMessage(message, sender);
    }

    if (isRetailerContentMessage(message)) {
      if (!isRetailerContentSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleRetailerMessage(message, sender);
    }

    if (isWalmartContentMessage(message)) {
      if (!isWalmartContentSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleWalmartContentMessage(message, sender);
    }

    if (isUiMessage(message)) {
      if (!isExtensionPageSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleUiMessage(message, sender);
    }

    if (message.type === "WATCH_CONFIG" || message.type === "PING") {
      return undefined;
    }

    if (
      message.type === "RETAILER_START_AUTO" ||
      message.type === "RETAILER_GET_PURCHASE_LIMIT" ||
      message.type === "SCAN_DETECTED_DOMAINS" ||
      message.type === "WALMART_RECORDING_START" ||
      message.type === "WALMART_RECORDING_STOP" ||
      message.type === "WALMART_RECORDING_MARK" ||
      message.type === "WALMART_AUTO_REFRESH_CONFIG"
    ) {
      return undefined;
    }

    return undefined;
  } catch (error) {
    console.error("Handler error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Handler failed" };
  }
}
