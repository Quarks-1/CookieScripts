import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isExtensionContextValid,
  sendCandidateLinks,
  sendChannelInactive,
} from "@ext/lib/messages.ts";

const CANDIDATE_PAYLOAD = {
  type: "CANDIDATE_LINKS" as const,
  channel_id: "123",
  urls: ["https://example.com"],
  author: "user",
};

describe("isExtensionContextValid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when chrome.runtime.id is available", () => {
    vi.stubGlobal("chrome", { runtime: { id: "extension-id" } });
    expect(isExtensionContextValid()).toBe(true);
  });

  it("returns false when chrome.runtime access throws", () => {
    vi.stubGlobal("chrome", {
      get runtime() {
        throw new Error("Extension context invalidated.");
      },
    });
    expect(isExtensionContextValid()).toBe(false);
  });
});

describe("sendCandidateLinks", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips messaging when extension context is invalid", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      get runtime() {
        throw new Error("Extension context invalidated.");
      },
    });

    await sendCandidateLinks(CANDIDATE_PAYLOAD);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not retry or warn when sendMessage reports invalidated context", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error("Extension context invalidated."));
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await sendCandidateLinks(CANDIDATE_PAYLOAD);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("retries transient failures before warning", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Service worker unavailable"))
      .mockResolvedValueOnce(undefined);
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await sendCandidateLinks(CANDIDATE_PAYLOAD);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("sendChannelInactive", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips messaging when extension context is invalid", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      get runtime() {
        throw new Error("Extension context invalidated.");
      },
    });

    await sendChannelInactive();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
