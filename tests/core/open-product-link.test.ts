import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  openTargetLinkRepeated,
  openPassiveProductLink,
  waitForRetailerTabReady,
} from "@ext/core/background/open-product-link.ts";
import {
  clearRetailerRuntimeState,
  getRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

const EXTENSION_ID = "test-extension-id";
const PRODUCT_URL = "https://www.target.com/p/foo/-/A-123";
const CHANNEL_ID = "222";
const HISTORY_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function buildRetailerSettings(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_SETTINGS,
    retailer_auto_atc_enabled: true,
    ...overrides,
    channel_targets: [
      buildChannelTarget({
        channel_id: CHANNEL_ID,
        allowed_domains: ["target.com"],
      }),
    ],
  };
}

describe("open-product-link", () => {
  let storage: Record<string, unknown>;
  let pingResponses: Array<{ ok: boolean } | undefined>;
  let startAutoResponses: Array<"ok" | "throw">;
  let windowTabId: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearRetailerRuntimeState();
    windowTabId = 99;
    storage = {
      "cookiescripts:history": [],
    };
    pingResponses = [];
    startAutoResponses = ["ok"];

    vi.stubGlobal("chrome", {
      runtime: { id: EXTENSION_ID },
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (storage[key] !== undefined) {
                result[key] = storage[key];
              }
            }
            return result;
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(storage, items);
          }),
        },
      },
      tabs: {
        create: vi.fn(async () => ({ id: 42 })),
        get: vi.fn(async () => ({ id: windowTabId, status: "complete" })),
        sendMessage: vi.fn(async (_tabId: number, message: { type: string }) => {
          if (message.type === "RETAILER_PING") {
            const next = pingResponses.shift();
            if (next === undefined) {
              return undefined;
            }
            return next;
          }
          if (message.type === "RETAILER_START_AUTO") {
            const next = startAutoResponses.shift() ?? "throw";
            if (next === "throw") {
              throw new Error("No receiver");
            }
          }
          return { ok: true };
        }),
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        create: vi.fn(async () => {
          windowTabId += 1;
          return { id: 10 + windowTabId, tabs: [{ id: windowTabId }] };
        }),
        remove: vi.fn(async () => undefined),
      },
    });
  });

  it("opens passive links in a new unfocused window", async () => {
    await openPassiveProductLink("https://example.com", { inWindow: true });
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "https://example.com",
      focused: false,
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens passive target links in focused windows when auto atc is off", async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: CHANNEL_ID,
          allowed_domains: ["target.com"],
        }),
      ],
    };

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, settings, {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([PRODUCT_URL]);
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: PRODUCT_URL,
      focused: true,
    });
  });

  it("opens passive links in a background tab when inWindow is false", async () => {
    await openPassiveProductLink("https://example.com", { inWindow: false });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com",
      active: false,
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("starts auto mode when retailer tab becomes ready", async () => {
    pingResponses = [{ ok: true }];

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, buildRetailerSettings(), {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([PRODUCT_URL]);
    expect(result.histories[0]?.kind).toBe("retailer_window_opened");
    expect(chrome.windows.create).toHaveBeenCalledWith({ url: PRODUCT_URL, focused: true });
    expect(getRetailerTabUiState(100)).toEqual({
      status: "Running auto mode…",
      running: true,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ type: "RETAILER_START_AUTO", channel_id: CHANNEL_ID }),
    );
  });

  it("retries start auto when the content script is not ready yet", async () => {
    startAutoResponses = ["throw", "throw", "ok"];

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, buildRetailerSettings(), {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([PRODUCT_URL]);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ type: "RETAILER_START_AUTO" }),
    );
    expect(storage["cookiescripts:history"]).toEqual([]);
  });

  it("returns failure history when auto start cannot be delivered", async () => {
    startAutoResponses = Array.from({ length: 40 }, () => "throw" as const);

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, buildRetailerSettings(), {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([]);
    expect(result.histories[0]).toEqual(
      expect.objectContaining({
        kind: "retailer_auto_failed",
        url: PRODUCT_URL,
        channel_id: CHANNEL_ID,
        timestamp: HISTORY_TIMESTAMP,
        error: "Automation failed to start",
      }),
    );
    expect(storage["cookiescripts:history"]).toEqual([]);
    expect(chrome.windows.remove).toHaveBeenCalled();
  });

  it("opens target product links repeatedly with auto mode", async () => {
    startAutoResponses = ["ok", "ok", "ok"];
    const settings = buildRetailerSettings({ retailer_link_open_count: 3 });

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, settings, {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([PRODUCT_URL, PRODUCT_URL, PRODUCT_URL]);
    expect(result.histories).toHaveLength(3);
    expect(result.histories.every((entry) => entry.kind === "retailer_window_opened")).toBe(true);
    expect(chrome.windows.create).toHaveBeenCalledTimes(3);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
  });

  it("continues repeat opens after auto start failure", async () => {
    startAutoResponses = Array.from({ length: 40 }, () => "throw" as const);
    const settings = buildRetailerSettings({ retailer_link_open_count: 2 });

    const result = await openTargetLinkRepeated(PRODUCT_URL, CHANNEL_ID, settings, {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual([]);
    expect(result.histories).toHaveLength(2);
    expect(result.histories.every((entry) => entry.kind === "retailer_auto_failed")).toBe(true);
    expect(chrome.windows.create).toHaveBeenCalledTimes(2);
  });

  it("opens non-target links once regardless of open count", async () => {
    const settings = buildRetailerSettings({ retailer_link_open_count: 3 });

    const result = await openTargetLinkRepeated("https://walmart.com/item", CHANNEL_ID, settings, {
      inWindow: true,
      author: "alice",
      timestamp: HISTORY_TIMESTAMP,
    });

    expect(result.opened).toEqual(["https://walmart.com/item"]);
    expect(result.histories).toHaveLength(1);
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it("waitForRetailerTabReady returns false when ping never succeeds", async () => {
    vi.useFakeTimers();
    pingResponses = Array.from({ length: 50 }, () => undefined);

    const promise = waitForRetailerTabReady(99, 1_000);
    await vi.advanceTimersByTimeAsync(1_100);
    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
  });
});
