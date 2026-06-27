import { describe, expect, it, vi } from "vitest";

import { runPlaybackEngine } from "@ext/lib/retailer/playback-engine.ts";

describe("playback-engine", () => {
  it("runs step sequence via callbacks", async () => {
    const navigate = vi.fn();
    const result = await runPlaybackEngine(
      [
        { type: "click", selectors: ['[data-test="shipItButton"]'], label: "Ship" },
        { type: "navigate", url: "https://www.target.com/checkout/start" },
      ],
      {
        click: vi.fn(async () => true),
        keyboardEnterHold: vi.fn(async () => true),
        waitForCartDelta: vi.fn(async () => true),
        navigate,
      },
    );

    expect(result).toEqual({ ok: true });
    expect(navigate).toHaveBeenCalledWith("https://www.target.com/checkout/start");
  });
});
