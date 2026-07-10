import {
  runCheckoutAutoMode as runCheckoutAutoModeLoop,
} from "@ext/domains/target/content/automation/checkout-auto.ts";
import {
  clearRetailerAutoResume,
  isRetailerAutoUserStopped,
  readRetailerAutoResume,
  shouldResumeRetailerCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";
import { isExtensionContextInvalidatedError } from "@ext/core/lib/messages.ts";
import { endSession } from "@ext/domains/target/content/session/lifecycle.ts";
import {
  loadAutoConfig,
  shouldContinueAutoMode,
} from "@ext/domains/target/content/session/auto-mode.ts";
import { completeCheckoutSuccess } from "@ext/domains/target/content/session/checkout-abandon.ts";
import {
  publishUiState,
  reportAutoStatus,
  sendToBackground,
} from "@ext/domains/target/content/session/messaging.ts";
import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/target/content/session/session-state.ts";

export { completeCheckoutSuccess, maybeFailCheckoutAbandon } from "@ext/domains/target/content/session/checkout-abandon.ts";

export async function runCheckoutAutoMode(): Promise<void> {
  state.automationScheduled = false;
  if (session.running || state.stopAutoRequested || isRetailerAutoUserStopped()) {
    return;
  }

  const resume = shouldResumeRetailerCheckout(location.href);
  if (!resume) {
    return;
  }

  session.channelId = resume.channel_id;
  session.url = location.href;
  session.running = true;
  publishUiState("Completing checkout…", true);

  let skipReadyInFinally = false;
  let skipRunningResetInFinally = false;

  const checkoutCallbacks = {
    shouldContinue: shouldContinueAutoMode,
    isStopRequested: () => state.stopAutoRequested,
    getAutoCheckoutEnabled: () => state.cachedAutoCheckoutEnabled,
    getRefreshIntervalSec: () => state.cachedRefreshIntervalSec,
    publishUiState,
    requestHardReload: async () => {
      try {
        await sendToBackground({ type: "RETAILER_HARD_RELOAD" });
      } catch (err) {
        if (isExtensionContextInvalidatedError(err)) {
          endSession();
        }
      }
    },
    onSuccess: completeCheckoutSuccess,
    onFailed: async (error: string) => {
      publishUiState(`Error: ${error}`, false);
      clearRetailerAutoResume();
      await reportAutoStatus("failed", error);
      skipReadyInFinally = true;
    },
    onStopped: async () => {
      publishUiState("Stopped", false);
      clearRetailerAutoResume();
      await reportAutoStatus("failed", "Stopped");
      skipReadyInFinally = true;
    },
  };

  try {
    const config = await loadAutoConfig(resume.channel_id);
    applyCachedAutoConfig(config);

    if (!state.cachedAutoCheckoutEnabled) {
      await checkoutCallbacks.onStopped();
      return;
    }

    const outcome = await runCheckoutAutoModeLoop(checkoutCallbacks);

    switch (outcome) {
      case "success":
        skipRunningResetInFinally = true;
        skipReadyInFinally = true;
        break;
      case "reloading":
        skipRunningResetInFinally = true;
        break;
      case "stopped":
      case "checkout_disabled":
      case "auth_required":
        skipReadyInFinally = true;
        break;
      case "failed":
      case "abandoned":
        if (!skipReadyInFinally) {
          await checkoutCallbacks.onFailed(
            outcome === "abandoned" ? "Left checkout" : "Checkout automation failed",
          );
        }
        skipReadyInFinally = true;
        break;
    }
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
      return;
    }
    const message = err instanceof Error ? err.message : "Checkout automation failed";
    publishUiState(message, false);
    clearRetailerAutoResume();
    await reportAutoStatus("failed", message);
    skipReadyInFinally = true;
  } finally {
    if (!skipRunningResetInFinally) {
      session.running = false;
    }
    if (!state.sessionEnded && !readRetailerAutoResume() && !skipReadyInFinally) {
      publishUiState("Ready — open a product page and press Start", false);
    }
  }
}
