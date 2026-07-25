import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { clearRetailerRuntimeState } from "@ext/domains/target/background/runtime-state.ts";
import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { mockContentSender, mockRetailerContentSender } from "../fixtures/fixtures.ts";

const CATALOG = {
  schema_version: 1,
  product_types: ["elite_trainer_box"],
  sets: [{ id: "test-set", name: "Test Set" }],
  products: [
    {
      id: "test-product",
      name: "Perfect Order ETB",
      type: "elite_trainer_box",
      msrp_cents: 4999,
      contents: [{ set_id: "test-set" }],
      listings: [{ retailer: "target", sku: "95230445" }],
    },
  ],
};

describe("handleMessage — target price gate", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    clearRetailerRuntimeState();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
    await chrome.storage.local.set({
      [STORAGE_KEYS.catalogCache]: {
        fetchedAt: Date.now(),
        etag: '"etag"',
        raw: CATALOG,
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 500, ok: false })));
  });

  it("looks up expected catalog price for target content senders", async () => {
    const sender = mockRetailerContentSender({ tabId: 9 });

    const response = await handleMessage(
      { type: "RETAILER_LOOKUP_EXPECTED_PRICE", tcin: "95230445" },
      sender,
    );

    expect(response).toEqual({
      ok: true,
      expected_price_cents: 4999,
      product_name: "Perfect Order ETB",
    });
  });

  it("returns null expected price when sku is not in catalog", async () => {
    const sender = mockRetailerContentSender({ tabId: 9 });

    const response = await handleMessage(
      { type: "RETAILER_LOOKUP_EXPECTED_PRICE", tcin: "99999999" },
      sender,
    );

    expect(response).toEqual({ ok: true, expected_price_cents: null });
  });

  it("rejects lookup from non-target senders", async () => {
    const sender = mockContentSender({ tabId: 9 });

    const response = await handleMessage(
      { type: "RETAILER_LOOKUP_EXPECTED_PRICE", tcin: "95230445" },
      sender,
    );

    expect(response).toEqual({ ok: false, error: "Unauthorized sender" });
  });
});
