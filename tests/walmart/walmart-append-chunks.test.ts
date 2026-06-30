import { describe, expect, it } from "vitest";

import { splitAppendPayload } from "@ext/domains/walmart/lib/append-chunks.ts";
import { MAX_APPEND_CHUNK_BYTES } from "@ext/domains/walmart/lib/constants.ts";

describe("splitAppendPayload", () => {
  it("returns a single chunk when under limit", () => {
    const payload = {
      sessionId: "s1",
      events: [{ kind: "session_start" as const, ts: "t", url: "https://www.walmart.com" }],
    };
    expect(splitAppendPayload(payload)).toHaveLength(1);
  });

  it("splits oversized batches into multiple chunks", () => {
    const bigHtml = "x".repeat(550_000);
    const payload = {
      sessionId: "s1",
      events: [
        { kind: "page_snapshot" as const, ts: "t", url: "u", trigger: "nav", pageId: "p1" },
        { kind: "network" as const, ts: "t", transport: "fetch" as const, method: "GET", url: "/a" },
      ],
      pages: [
        {
          pageId: "p1",
          url: "https://www.walmart.com",
          title: "t",
          htmlTruncated: bigHtml,
          domSummary: [],
          capturedAt: "t",
          trigger: "nav",
        },
      ],
      byteDelta: 100,
      droppedEvents: 2,
      truncated: true,
    };
    const chunks = splitAppendPayload(payload);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(JSON.stringify(chunk)).length).toBeLessThanOrEqual(
        MAX_APPEND_CHUNK_BYTES + 50_000,
      );
    }
    const totalEvents = chunks.reduce((sum, chunk) => sum + chunk.events.length, 0);
    expect(totalEvents).toBe(payload.events.length);
  });
});
