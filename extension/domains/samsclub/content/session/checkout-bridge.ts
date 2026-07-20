import {
  runCheckoutAutoMode as runCheckoutAutoModeLoop,
} from "@ext/domains/samsclub/content/automation/checkout-auto.ts";
import {
  clearSamsclubAutoResume,
  isSamsclubAutoUserStopped,
  readSamsclubAutoResume,
  shouldResumeSamsclubCheckout,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  clearSamsclubCheckoutDebugLog,
  samsclubCheckoutDebug,
} from "@ext/domains/samsclub/lib/checkout/debug-log.ts";
import { readySamsclubAutoModeMessage } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { isExtensionContextInvalidatedError } from "@ext/core/lib/messages.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import {
  loadAutoConfig,
  shouldContinueAutoMode,
} from "@ext/domains/samsclub/content/session/auto-mode.ts";
import {
  completeCheckoutHandoff,
  completeCheckoutSuccess,
} from "@ext/domains/samsclub/content/session/checkout-abandon.ts";
import {
  publishUiState,
  reportAutoStatus,
  sendToBackground,
} from "@ext/domains/samsclub/content/session/messaging.ts";
import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";

export { completeCheckoutSuccess, maybeFailCheckoutAbandon } from "@ext/domains/samsclub/content/session/checkout-abandon.ts";

export async function runCheckoutAutoMode(): Promise<void> {
  state.automationScheduled = false;
  if (state.stopAutoRequested || isSamsclubAutoUserStopped()) {
    samsclubCheckoutDebug("checkout-bridge", "skip run — stopped", {
      stopAutoRequested: state.stopAutoRequested,
      userStopped: isSamsclubAutoUserStopped(),
    });
    return;
  }

  const resume = shouldResumeSamsclubCheckout(location.href);
  if (!resume) {
    if (session.running) {
      samsclubCheckoutDebug("checkout-bridge", "skip run — session busy without checkout resume");
      return;
    }
    samsclubCheckoutDebug("checkout-bridge", "skip run — no checkout resume", {
      url: location.href,
      resume: readSamsclubAutoResume(),
    });
    return;
  }

  if (session.running) {
    samsclubCheckoutDebug("checkout-bridge", "reclaim session from PDP handoff");
    session.running = false;
  }

  await clearSamsclubCheckoutDebugLog();
  samsclubCheckoutDebug("checkout-bridge", "starting", {
    url: location.href,
    channelId: resume.channel_id,
    autoCheckoutEnabled: resume.auto_checkout_enabled,
  });

  session.channelId = resume.channel_id;
  session.url = location.href;

  const config = await loadAutoConfig(resume.channel_id);
  applyCachedAutoConfig(config);
  if (resume.auto_checkout_enabled) {
    state.cachedAutoCheckoutEnabled = true;
  }

  session.running = true;
  publishUiState("Completing checkout…", true);

  let skipReadyInFinally = false;
  let skipRunningResetInFinally = false;

  const checkoutCallbacks = {
    shouldContinue: shouldContinueAutoMode,
    isStopRequested: () => state.stopAutoRequested,
    getAutoCheckoutEnabled: () => state.cachedAutoCheckoutEnabled,
    getCheckoutCvv: () => state.cachedCheckoutCvv,
    getRefreshIntervalSec: () => state.cachedRefreshIntervalSec,
    publishUiState,
    requestHardReload: async () => {
      try {
        await sendToBackground({ type: "SAMSCLUB_HARD_RELOAD" });
      } catch (err) {
        if (isExtensionContextInvalidatedError(err)) {
          endSession();
        }
      }
    },
    onSuccess: completeCheckoutSuccess,
    onFailed: async (error: string) => {
      publishUiState(`Error: ${error}`, false);
      clearSamsclubAutoResume();
      await reportAutoStatus("failed", error);
      skipReadyInFinally = true;
    },
    onStopped: async () => {
      publishUiState("Stopped", false);
      clearSamsclubAutoResume();
      await reportAutoStatus("failed", "Stopped");
      skipReadyInFinally = true;
    },
  };

  try {
    const shouldRunFullCheckout =
      resume.auto_checkout_enabled || state.cachedAutoCheckoutEnabled;

    samsclubCheckoutDebug("checkout-bridge", "config loaded", {
      shouldRunFullCheckout,
      cachedAutoCheckoutEnabled: state.cachedAutoCheckoutEnabled,
      hasCheckoutCvv: state.cachedCheckoutCvv != null,
      refreshIntervalSec: state.cachedRefreshIntervalSec,
    });

    if (!shouldRunFullCheckout) {
      samsclubCheckoutDebug("checkout-bridge", "handoff — auto checkout disabled");
      await completeCheckoutHandoff();
      skipReadyInFinally = true;
      return;
    }

    const outcome = await runCheckoutAutoModeLoop(checkoutCallbacks);

    samsclubCheckoutDebug("checkout-bridge", "loop finished", { outcome });

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
      samsclubCheckoutDebug("checkout-bridge", "extension context invalidated");
      endSession();
      return;
    }
    const message = err instanceof Error ? err.message : "Checkout automation failed";
    samsclubCheckoutDebug("checkout-bridge", "error", { message });
    publishUiState(message, false);
    clearSamsclubAutoResume();
    await reportAutoStatus("failed", message);
    skipReadyInFinally = true;
  } finally {
    if (!skipRunningResetInFinally) {
      session.running = false;
    }
    if (!state.sessionEnded && !readSamsclubAutoResume() && !skipReadyInFinally) {
      samsclubCheckoutDebug("checkout-bridge", "publish ready");
      publishUiState(readySamsclubAutoModeMessage(location.href), false);
    }
  }
}
