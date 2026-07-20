import {
  session,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";
import {
  teardownPurchaseLimitWatch,
  teardownPurchaseLimitPageShow,
} from "@ext/domains/samsclub/content/session/purchase-limit.ts";

export function endSession(): void {
  if (state.sessionEnded) {
    return;
  }
  state.sessionEnded = true;
  state.unhookSamsclubNavigation?.();
  state.unhookSamsclubNavigation = null;
  teardownPurchaseLimitPageShow();
  teardownPurchaseLimitWatch();
  session.channelId = null;
  session.url = null;
  session.running = false;
}
