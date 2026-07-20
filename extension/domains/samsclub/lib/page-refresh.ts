import {
  markSamsclubAutoRefreshed,
  readSamsclubAutoResume,
} from "@ext/domains/samsclub/lib/auto-resume.ts";

export type StallTimestampField = "last_refresh_at" | "last_checkout_progress_at";

export type HardRefreshWhileWaitingOptions = {
  refreshIntervalSec: number;
  shouldContinue: () => boolean;
  onStatus?: (status: string) => void;
  requestHardReload: () => Promise<void>;
  /** Which resume timestamp gates the refresh interval (default: last_refresh_at). */
  stallTimestampField?: StallTimestampField;
};

export async function maybeHardRefreshWhileWaiting(
  options: HardRefreshWhileWaitingOptions,
): Promise<"continue" | "reloading" | "aborted"> {
  if (options.refreshIntervalSec <= 0) {
    return "continue";
  }

  const resume = readSamsclubAutoResume();
  if (!resume) {
    return "continue";
  }

  const stallField = options.stallTimestampField ?? "last_refresh_at";
  const stallAt =
    stallField === "last_checkout_progress_at"
      ? resume.last_checkout_progress_at
      : resume.last_refresh_at;
  const elapsedMs = Date.now() - stallAt;
  if (elapsedMs < options.refreshIntervalSec * 1000) {
    return "continue";
  }

  if (!options.shouldContinue()) {
    return "aborted";
  }

  markSamsclubAutoRefreshed();
  options.onStatus?.(`Hard refreshing (${options.refreshIntervalSec}s)…`);
  await options.requestHardReload();
  return "reloading";
}
