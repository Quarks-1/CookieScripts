import { describe, expect, it } from "vitest";

import {
  validateChannelTarget,
  validatePersistedTargets,
} from "@ext/core/lib/validate.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

describe("validatePersistedTargets", () => {
  it("accepts empty list", () => {
    expect(validatePersistedTargets([])).toBeNull();
  });

  it("accepts valid targets", () => {
    expect(validatePersistedTargets([buildChannelTarget()])).toBeNull();
  });

  it("rejects non-numeric channel id", () => {
    expect(validatePersistedTargets([buildChannelTarget({ channel_id: "abc" })])).toMatch(
      /numeric/i,
    );
  });

  it("rejects zero channel id", () => {
    expect(validatePersistedTargets([buildChannelTarget({ channel_id: "0" })])).toMatch(
      /positive/i,
    );
  });

  it("rejects duplicate channel ids", () => {
    const target = buildChannelTarget();
    expect(validatePersistedTargets([target, target])).toMatch(/unique/i);
  });

  it("rejects empty domains on stored entry", () => {
    expect(validatePersistedTargets([buildChannelTarget({ allowed_domains: [] })])).toMatch(
      /allowed domain/i,
    );
  });
});

describe("validateChannelTarget", () => {
  it("accepts valid entry", () => {
    expect(validateChannelTarget(buildChannelTarget())).toBeNull();
  });

  it("rejects empty domains", () => {
    expect(validateChannelTarget(buildChannelTarget({ allowed_domains: [] }))).toMatch(
      /allowed domain/i,
    );
  });

  it("rejects keyword longer than max length", () => {
    expect(
      validateChannelTarget(
        buildChannelTarget({
          watch_keywords: {
            target: { positive: ["a".repeat(65)], negative: [] },
          },
        }),
      ),
    ).toMatch(/watch_keywords\.target\.positive/i);
  });

  it("rejects overlapping positive and negative keywords per retailer", () => {
    expect(
      validateChannelTarget(
        buildChannelTarget({
          watch_keywords: {
            walmart: { positive: ["scam"], negative: ["scam"] },
          },
        }),
      ),
    ).toMatch(/overlap/i);
  });
});
