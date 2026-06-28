/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRetailerAutoResume,
  ensureRetailerAutoResume,
  productPathFromUrl,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  startRetailerAutoResume,
} from "@ext/lib/retailer/auto-resume.ts";

const PAGE_URL = "https://www.target.com/p/restockr/-/A-1011209279";

describe("auto-resume", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("persists resume state per product path", () => {
    startRetailerAutoResume("222", PAGE_URL);
    const resume = readRetailerAutoResume();
    expect(resume?.channel_id).toBe("222");
    expect(resume?.product_path).toBe(productPathFromUrl(PAGE_URL));
  });

  it("resumes only for matching product path", () => {
    ensureRetailerAutoResume("222", PAGE_URL);
    expect(shouldResumeRetailerAuto(PAGE_URL)?.channel_id).toBe("222");
    expect(shouldResumeRetailerAuto("https://www.target.com/p/other/-/A-1")).toBeNull();
  });

  it("clears resume state on stop", () => {
    ensureRetailerAutoResume("222", PAGE_URL);
    clearRetailerAutoResume();
    expect(readRetailerAutoResume()).toBeNull();
  });
});
