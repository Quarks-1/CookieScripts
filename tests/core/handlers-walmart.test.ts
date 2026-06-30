import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { mockContentSender } from "../fixtures/fixtures.ts";

describe("handleMessage — walmart", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
  });

  it("rejects walmart content messages from non-walmart senders", async () => {
    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage({ type: "WALMART_PING" }, sender);

    expect(response).toEqual({ ok: false, error: "Unauthorized sender" });
  });
});
