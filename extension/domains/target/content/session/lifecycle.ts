import {
  session,
  state,
} from "@ext/domains/target/content/session/session-state.ts";
import {
  teardownPurchaseLimitWatch,
  teardownPurchaseLimitPageShow,
} from "@ext/domains/target/content/session/purchase-limit.ts";

export function endSession(): void {
  if (state.sessionEnded) {
    return;
  }
  state.sessionEnded = true;
  state.unhookRetailerNavigation?.();
  state.unhookRetailerNavigation = null;
  teardownPurchaseLimitPageShow();
  teardownPurchaseLimitWatch();
  session.channelId = null;
  session.url = null;
  session.running = false;
}
