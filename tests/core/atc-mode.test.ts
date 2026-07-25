import { describe, expect, it } from "vitest";

import {
  atcModeFromBooleans,
  booleansFromAtcMode,
  isAtcEnabled,
} from "@ext/core/lib/atc-mode.ts";

describe("atc-mode", () => {
  it("maps all four boolean combinations to modes", () => {
    expect(atcModeFromBooleans(false, false)).toBe("off");
    expect(atcModeFromBooleans(true, false)).toBe("frontend");
    expect(atcModeFromBooleans(false, true)).toBe("backend");
    expect(atcModeFromBooleans(true, true)).toBe("both");
  });

  it("round-trips modes through booleans", () => {
    const modes = ["off", "frontend", "backend", "both"] as const;
    for (const mode of modes) {
      expect(atcModeFromBooleans(...Object.values(booleansFromAtcMode(mode)) as [boolean, boolean])).toBe(
        mode,
      );
    }
  });

  it("isAtcEnabled is false only for off", () => {
    expect(isAtcEnabled(false, false)).toBe(false);
    expect(isAtcEnabled(true, false)).toBe(true);
    expect(isAtcEnabled(false, true)).toBe(true);
    expect(isAtcEnabled(true, true)).toBe(true);
  });
});
