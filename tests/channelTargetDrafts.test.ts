import { describe, expect, it } from "vitest";

import {
  draftsToTargets,
  newDraft,
  targetsToDrafts,
} from "@shared/lib/channelTargetDrafts.ts";
import { buildChannelTarget } from "./fixtures.ts";

describe("channelTargetDrafts", () => {
  it("round-trips targets through drafts", () => {
    const targets = [
      buildChannelTarget({ channel_id: "111", allowed_domains: ["walmart.com"] }),
      buildChannelTarget({ channel_id: "222", allowed_domains: ["amazon.com", "target.com"] }),
    ];
    const drafts = targetsToDrafts(targets);
    expect(draftsToTargets(drafts)).toEqual(targets);
  });

  it("returns one empty draft when no targets", () => {
    const drafts = targetsToDrafts([]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.channel_id).toBe("");
    expect(drafts[0]!.pills).toEqual([]);
  });

  it("preserves channel id on newDraft", () => {
    const draft = newDraft("999", ["example.com"]);
    expect(draft.channel_id).toBe("999");
    expect(draft.pills).toEqual([{ domain: "example.com", enabled: true }]);
  });
});
