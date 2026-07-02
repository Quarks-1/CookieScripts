import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, WalmartToBackground } from "@ext/core/types/index.ts";

export async function requestTabConsolidation(
  trigger: Extract<
    WalmartToBackground,
    { type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST" }
  >["trigger"],
): Promise<void> {
  await sendToBackground<BackgroundResponse>({
    type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST",
    trigger,
  });
}
