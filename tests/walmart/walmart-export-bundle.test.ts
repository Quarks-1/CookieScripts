import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";

import { buildExportZip } from "@ext/domains/walmart/lib/export-bundle.ts";
import { createSession } from "@ext/domains/walmart/lib/idb/session-store.ts";
import { appendEvents } from "@ext/domains/walmart/lib/idb/event-store.ts";
import { appendPages } from "@ext/domains/walmart/lib/idb/pages-store.ts";

describe("walmart export-bundle", () => {
  it("builds zip with expected manifest paths", async () => {
    const sessionId = "export-test-session";
    await createSession({
      sessionId,
      tabId: 42,
      tabIds: [42, 99],
      primaryTabId: 42,
      failedAttachTabIds: [100],
      url: "https://www.walmart.com/ip/test",
      userAgent: "vitest",
    });
    await appendEvents(sessionId, [
      {
        kind: "marker",
        ts: new Date().toISOString(),
        label: "Past queue",
      },
    ]);

    const { zipBytes, downloadFilename } = await buildExportZip(sessionId);
    expect(downloadFilename).toMatch(/CookieScripts\/walmart-live\/.+\/session-.+\.zip$/);

    const entries = unzipSync(zipBytes);
    const paths = Object.keys(entries);
    expect(paths.some((p) => p.endsWith("/manifest.json"))).toBe(true);
    expect(paths.some((p) => p.endsWith("/timeline.jsonl"))).toBe(true);
    expect(paths.some((p) => p.endsWith("/network.jsonl"))).toBe(true);

    const manifestPath = paths.find((p) => p.endsWith("/manifest.json"));
    expect(manifestPath).toBeDefined();
    const manifest = JSON.parse(new TextDecoder().decode(entries[manifestPath!]));
    expect(manifest.tabCount).toBe(2);
    expect(manifest.tabIds).toEqual([42, 99]);
    expect(manifest.failedAttachTabIds).toEqual([100]);
  });

  it("prefixes page filenames with tab id", async () => {
    const sessionId = "export-page-tab-session";
    await createSession({
      sessionId,
      tabId: 7,
      tabIds: [7],
      primaryTabId: 7,
      url: "https://www.walmart.com/ip/page",
      userAgent: "vitest",
    });
    await appendPages(sessionId, [
      {
        pageId: "p1",
        url: "https://www.walmart.com/ip/page",
        title: "Test",
        htmlTruncated: "<html></html>",
        domSummary: [],
        capturedAt: new Date().toISOString(),
        trigger: "navigation",
        tabId: 7,
      },
    ]);

    const { zipBytes } = await buildExportZip(sessionId);
    const paths = Object.keys(unzipSync(zipBytes));
    expect(paths.some((p) => p.includes("/pages/t7-001-navigation.json"))).toBe(true);
  });
});
