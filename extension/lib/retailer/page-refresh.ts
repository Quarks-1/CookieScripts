import {
  markRetailerAutoRefreshed,
  readRetailerAutoResume,
} from "@ext/lib/retailer/auto-resume.ts";

export type HardRefreshWhileWaitingOptions = {
  refreshIntervalSec: number;
  shouldContinue: () => boolean;
  onStatus?: (status: string) => void;
  requestHardReload: () => Promise<void>;
};

export async function maybeHardRefreshWhileWaiting(
  options: HardRefreshWhileWaitingOptions,
): Promise<"continue" | "reloading" | "aborted"> {
  if (options.refreshIntervalSec <= 0) {
    return "continue";
  }

  const resume = readRetailerAutoResume();
  if (!resume) {
    return "continue";
  }

  const elapsedMs = Date.now() - resume.last_refresh_at;
  if (elapsedMs < options.refreshIntervalSec * 1000) {
    return "continue";
  }

  if (!options.shouldContinue()) {
    return "aborted";
  }

  markRetailerAutoRefreshed();
  options.onStatus?.(`Hard refreshing (${options.refreshIntervalSec}s)…`);
  await options.requestHardReload();
  return "reloading";
}
