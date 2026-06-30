import { describe, expect, it } from "vitest";

import { parseChannelId } from "@ext/core/lib/channels.ts";

describe("parseChannelId", () => {
  it("returns channel id from guild channel URL", () => {
    expect(parseChannelId("/channels/111222333444555666/987654321098765432")).toBe(
      "987654321098765432",
    );
  });

  it("returns channel id from @me DM URL", () => {
    expect(parseChannelId("/channels/@me/987654321098765432")).toBe("987654321098765432");
  });

  it("returns null when not on channels path", () => {
    expect(parseChannelId("/app")).toBeNull();
    expect(parseChannelId("/")).toBeNull();
  });

  it("returns null when channel segment is missing", () => {
    expect(parseChannelId("/channels/111222333444555666")).toBeNull();
  });

  it("returns null when channel segment is non-numeric", () => {
    expect(parseChannelId("/channels/@me/thread-view")).toBeNull();
  });

  it("returns parent channel id for thread URLs (third segment)", () => {
    expect(parseChannelId("/channels/111/222/333")).toBe("222");
  });

  it("ignores trailing segments beyond channel id", () => {
    expect(parseChannelId("/channels/111/222/extra/segments")).toBe("222");
  });
});
