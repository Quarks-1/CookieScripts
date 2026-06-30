import { isExtensionContextInvalidatedError } from "@ext/core/lib/messages.ts";
import { endSession } from "@ext/domains/target/content/session/lifecycle.ts";
import { session, state } from "@ext/domains/target/content/session/session-state.ts";

export function scheduleAutomationRun(runner: () => Promise<void>): void {
  state.automationScheduled = true;
  const generation = ++session.syncGeneration;
  state.syncChain = state.syncChain
    .then(async () => {
      if (generation !== session.syncGeneration) {
        return;
      }
      await runner();
    })
    .catch((err) => {
      if (generation === session.syncGeneration) {
        state.automationScheduled = false;
      }
      if (isExtensionContextInvalidatedError(err)) {
        endSession();
      }
    });
}
