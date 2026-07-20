import { runCheckoutAutoMode } from "@ext/domains/samsclub/content/session/checkout-bridge.ts";
import { scheduleAutomationRun } from "@ext/domains/samsclub/content/session/schedule.ts";

export function scheduleCheckoutAutoModeRun(): void {
  scheduleAutomationRun(runCheckoutAutoMode);
}
