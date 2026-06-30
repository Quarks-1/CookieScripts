/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach } from "vitest";

import {
  PENDING_RETAILER_START_AUTO_KEY,
  stashPendingStartAuto,
  takePendingStartAuto,
} from "@ext/lib/retailer/pending-start-auto.ts";

describe("pending-start-auto", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a start-auto payload", () => {
    const message = {
      type: "RETAILER_START_AUTO" as const,
      channel_id: "123",
      url: "https://www.target.com/p/foo/-/A-1",
      source: "discord" as const,
      refresh_interval_sec: 10,
      frontend_atc_enabled: true,
      backend_atc_enabled: true,
      atc_quantity: 2,
      use_max_quantity: true,
    };

    stashPendingStartAuto(message);
    expect(sessionStorage.getItem(PENDING_RETAILER_START_AUTO_KEY)).not.toBeNull();
    expect(takePendingStartAuto()).toEqual(message);
    expect(sessionStorage.getItem(PENDING_RETAILER_START_AUTO_KEY)).toBeNull();
    expect(takePendingStartAuto()).toBeNull();
  });

  it("rejects invalid stored payloads", () => {
    sessionStorage.setItem(PENDING_RETAILER_START_AUTO_KEY, JSON.stringify({ type: "nope" }));
    expect(takePendingStartAuto()).toBeNull();
  });
});
