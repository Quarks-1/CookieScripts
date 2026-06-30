import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { MAX_RETAINED_SESSIONS } from "@ext/domains/walmart/lib/constants.ts";
import { createSession, listSessions, pruneOldSessions } from "@ext/domains/walmart/lib/idb/session-store.ts";

describe("walmart idb session-store", () => {
  beforeEach(async () => {
    const sessions = await listSessions();
    for (const session of sessions) {
      const { deleteSession } = await import("@ext/domains/walmart/lib/idb/session-store.ts");
      await deleteSession(session.sessionId);
    }
  });

  it("prunes oldest sessions beyond retention limit", async () => {
    for (let i = 0; i < MAX_RETAINED_SESSIONS + 2; i += 1) {
      await createSession({
        sessionId: `session-${i}`,
        tabId: i,
        url: `https://www.walmart.com/${i}`,
        userAgent: "vitest",
      });
    }
    await pruneOldSessions();
    const remaining = await listSessions();
    expect(remaining.length).toBeLessThanOrEqual(MAX_RETAINED_SESSIONS);
  });
});
