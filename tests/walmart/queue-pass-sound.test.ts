import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  playQueuePassAlert,
  resetQueuePassSoundCacheForTests,
} from "@ext/domains/walmart/lib/queue-pass-sound.ts";

describe("playQueuePassAlert", () => {
  beforeEach(() => {
    resetQueuePassSoundCacheForTests();
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );
  });

  it("falls back to Web Audio beep when custom sound is missing", async () => {
    const start = vi.fn();
    vi.stubGlobal("AudioContext", class {
      createOscillator() {
        return { type: "sine", frequency: { value: 0 }, connect: vi.fn(), start, stop: vi.fn() };
      }
      createGain() {
        return { gain: { value: 0 }, connect: vi.fn() };
      }
      get destination() {
        return {};
      }
      close = vi.fn();
    });

    await playQueuePassAlert(1);

    expect(start).toHaveBeenCalled();
  });
});
