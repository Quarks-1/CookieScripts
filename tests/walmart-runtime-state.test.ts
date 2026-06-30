import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bindWalmartTab,
  clearWalmartRuntimeState,
  getActiveRecordingSessionId,
  isLastRecordingTab,
  listRecordingTabIds,
  recordingTabCount,
  setActiveRecordingSessionId,
  unbindWalmartTab,
} from "@ext/background/walmart-runtime-state.ts";

describe("walmart runtime state", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({}),
        },
      },
    });
    clearWalmartRuntimeState();
  });

  it("binds multiple tabs to one session", () => {
    bindWalmartTab(1, "session-a");
    bindWalmartTab(2, "session-a");
    expect(listRecordingTabIds("session-a")).toEqual([1, 2]);
    expect(recordingTabCount()).toBe(2);
  });

  it("tracks last recording tab", () => {
    bindWalmartTab(1, "session-a");
    expect(isLastRecordingTab(1)).toBe(true);
    bindWalmartTab(2, "session-a");
    expect(isLastRecordingTab(1)).toBe(false);
    expect(isLastRecordingTab(2)).toBe(false);
    unbindWalmartTab(1);
    expect(isLastRecordingTab(2)).toBe(true);
  });

  it("persists active recording session id", async () => {
    await setActiveRecordingSessionId("session-a");
    expect(getActiveRecordingSessionId()).toBe("session-a");
    expect(chrome.storage.session.set).toHaveBeenCalled();
    await setActiveRecordingSessionId(null);
    expect(getActiveRecordingSessionId()).toBeNull();
    expect(chrome.storage.session.remove).toHaveBeenCalled();
  });
});
