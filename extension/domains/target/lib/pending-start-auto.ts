import type { BackgroundToContent } from "@ext/core/types/index.ts";

export const PENDING_RETAILER_START_AUTO_KEY = "cookiescripts:pendingRetailerStartAuto";

export type PendingStartAutoMessage = Extract<
  BackgroundToContent,
  { type: "RETAILER_START_AUTO" }
>;

export function stashPendingStartAuto(message: PendingStartAutoMessage): void {
  sessionStorage.setItem(PENDING_RETAILER_START_AUTO_KEY, JSON.stringify(message));
}

export function takePendingStartAuto(): PendingStartAutoMessage | null {
  const raw = sessionStorage.getItem(PENDING_RETAILER_START_AUTO_KEY);
  sessionStorage.removeItem(PENDING_RETAILER_START_AUTO_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingStartAutoMessage;
    if (parsed?.type !== "RETAILER_START_AUTO" || typeof parsed.channel_id !== "string") {
      return null;
    }
    if (typeof parsed.url !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
