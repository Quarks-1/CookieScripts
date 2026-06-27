import { describe, expect, it } from "vitest";

import {
  compareVersions,
  isNewerVersion,
  parseReleaseVersion,
} from "@ext/lib/version.ts";

describe("parseReleaseVersion", () => {
  it("strips v prefix", () => {
    expect(parseReleaseVersion("v1.2.3")).toBe("1.2.3");
  });

  it("accepts version without prefix", () => {
    expect(parseReleaseVersion("1.2.3")).toBe("1.2.3");
  });

  it("rejects invalid tags", () => {
    expect(parseReleaseVersion("v1.0.0-beta")).toBeNull();
    expect(parseReleaseVersion("not-a-version")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders patch versions numerically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("0.9.0", "0.10.0")).toBeLessThan(0);
  });

  it("orders minor and major versions", () => {
    expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0", "0.1.9")).toBeGreaterThan(0);
  });

  it("returns zero for equal versions", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
  });
});

describe("isNewerVersion", () => {
  it("detects newer patch release", () => {
    expect(isNewerVersion("0.1.1", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.1.1")).toBe(false);
  });
});
