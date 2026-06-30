import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  openRetailerProductWindow,
  shouldOpenRetailerWindow,
  openPassiveProductTab,
  waitForRetailerTabReady,
} from "@ext/background/open-product-link.ts";
import {
  clearRetailerRuntimeState,
  getRetailerTabUiState,
  tryAcquireRetailerJob,
  releaseRetailerJob,
} from "@ext/background/retailer-runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";
import { buildChannelTarget } from "./fixtures.ts";

const EXTENSION_ID = "test-extension-id";
const PRODUCT_URL = "https://www.target.com/p/foo/-/A-123";
const CHANNEL_ID = "222";

function buildRetailerSettings() {
  return {
    ...DEFAULT_SETTINGS,
    channel_targets: [
      buildChannelTarget({
        channel_id: CHANNEL_ID,
        allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
      }),
    ],
  };
}

describe("open-product-link", () => {
  let storage: Record<string, unknown>;
  let pingResponses: Array<{ ok: boolean } | undefined>;
  let startAutoResponses: Array<"ok" | "throw">;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearRetailerRuntimeState();
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
        get: vi.fn(async () => ({ id: 99, status: "complete" })),
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
        create: vi.fn(async () => ({ id: 10, tabs: [{ id: 99 }] })),
      },
    });
  });

  it("detects retailer window branch", () => {
    const settings = buildRetailerSettings();
    expect(shouldOpenRetailerWindow(PRODUCT_URL, CHANNEL_ID, settings)).toBe(true);
    expect(shouldOpenRetailerWindow("https://walmart.com/item", CHANNEL_ID, settings)).toBe(
      false,
    );
  });

  it("opens passive tabs in background", async () => {
    await openPassiveProductTab("https://example.com");
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com",
      active: false,
    });
  });

  it("starts auto mode when retailer tab becomes ready", async () => {
    pingResponses = [{ ok: true }];

    const result = await openRetailerProductWindow(
      PRODUCT_URL,
      CHANNEL_ID,
      buildRetailerSettings(),
      { startAuto: true },
    );

    expect(result).toEqual({ opened: true, tabId: 99, queued: false });
    expect(chrome.windows.create).toHaveBeenCalledWith({ url: PRODUCT_URL, focused: true });
    expect(getRetailerTabUiState(99)).toEqual({
      status: "Running auto mode…",
      running: true,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ type: "RETAILER_START_AUTO", channel_id: CHANNEL_ID }),
    );
    expect(tryAcquireRetailerJob(CHANNEL_ID)).toBe(false);
    releaseRetailerJob(CHANNEL_ID);
  });

  it("retries start auto when the content script is not ready yet", async () => {
    startAutoResponses = ["throw", "throw", "ok"];

    const result = await openRetailerProductWindow(
      PRODUCT_URL,
      CHANNEL_ID,
      buildRetailerSettings(),
      { startAuto: true },
    );

    expect(result.opened).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ type: "RETAILER_START_AUTO" }),
    );
    expect(storage["cookiescripts:history"]).toEqual([]);
  });

  it("records failure history and releases job when auto start cannot be delivered", async () => {
    startAutoResponses = Array.from({ length: 40 }, () => "throw" as const);

    const result = await openRetailerProductWindow(
      PRODUCT_URL,
      CHANNEL_ID,
      buildRetailerSettings(),
      { startAuto: true },
    );

    expect(result.opened).toBe(true);
    expect(tryAcquireRetailerJob(CHANNEL_ID)).toBe(true);
    releaseRetailerJob(CHANNEL_ID);
    expect(storage["cookiescripts:history"]).toHaveLength(1);
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({
        kind: "retailer_auto_failed",
        url: PRODUCT_URL,
        channel_id: CHANNEL_ID,
        error: "Automation failed to start",
      }),
    ]);
    vi.restoreAllMocks();
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
