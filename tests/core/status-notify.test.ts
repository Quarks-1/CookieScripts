import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";

describe("notifyStatusChanged", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("increments and writes revision to session storage", async () => {
    const { notifyStatusChanged } = await import("@ext/core/background/status-notify.ts");

    await notifyStatusChanged();

    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.statusRevision]: 1,
    });
  });

  it("produces monotonic revisions on successive calls", async () => {
    const { notifyStatusChanged } = await import("@ext/core/background/status-notify.ts");

    await notifyStatusChanged();
    await notifyStatusChanged();
    await notifyStatusChanged();

    expect(chrome.storage.session.set).toHaveBeenNthCalledWith(1, {
      [STORAGE_KEYS.statusRevision]: 1,
    });
    expect(chrome.storage.session.set).toHaveBeenNthCalledWith(2, {
      [STORAGE_KEYS.statusRevision]: 2,
    });
    expect(chrome.storage.session.set).toHaveBeenNthCalledWith(3, {
      [STORAGE_KEYS.statusRevision]: 3,
    });
  });

  it("logs a warning and does not throw when session storage write fails", async () => {
    const { notifyStatusChanged } = await import("@ext/core/background/status-notify.ts");
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error("session write failed"));

    await expect(notifyStatusChanged()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      "CookieScripts: status revision notify failed",
      expect.any(Error),
    );
  });
});
