import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  onTabRemoved,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { mockExtensionPageSender } from "../fixtures/fixtures.ts";

describe("handleMessage — ui", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
  });

  it("accepts SAVE_SETTINGS with empty channel_targets", async () => {
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      {
        type: "SAVE_SETTINGS",
        settings: { enabled: true, channel_targets: [] },
      },
      sender,
    );

    expect(response).toEqual({ ok: true });
  });

  it("clears active channel on tab removed", () => {
    activeChannels.set(5, "222");
    onTabRemoved(5);
    expect(activeChannels.has(5)).toBe(false);
  });

  it("clears dedup keys when history is cleared", async () => {
    recentUrlKeys.add("https://walmart.com/item");
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage({ type: "CLEAR_HISTORY" }, sender);

    expect(response).toEqual({ ok: true });
    expect(recentUrlKeys.size).toBe(0);
  });

  it("persists retailer auto checkout toggle", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_AUTO_CHECKOUT_ENABLED", enabled: true },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      ...DEFAULT_SETTINGS,
      retailer_auto_checkout_enabled: true,
    });
  });

  it("persists global retailer auto atc toggle without channel_id", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_AUTO_ATC_ENABLED", enabled: true },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      ...DEFAULT_SETTINGS,
      retailer_auto_atc_enabled: true,
    });
  });

  it("disables global retailer auto atc without domain error", async () => {
    const storage = setupChromeMocks();
    storage["cookiescripts:settings"] = {
      ...DEFAULT_SETTINGS,
      retailer_auto_atc_enabled: true,
    };
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_AUTO_ATC_ENABLED", enabled: false },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      ...DEFAULT_SETTINGS,
    });
  });
});
