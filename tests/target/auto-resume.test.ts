/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRetailerAutoUserStopped,
  ensureRetailerAutoResume,
  isRetailerAutoUserStopped,
  markRetailerAutoUserStopped,
  productPathFromUrl,
  readRetailerAutoResume,
  shouldResumeRetailerAuto,
  shouldResumeRetailerCheckout,
  startRetailerAutoResume,
  transitionRetailerAutoResumeToCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";

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
    markRetailerAutoUserStopped();
    expect(readRetailerAutoResume()).toBeNull();
    expect(isRetailerAutoUserStopped()).toBe(true);
    expect(shouldResumeRetailerAuto(PAGE_URL)).toBeNull();
  });

  it("allows resume again after user stop is cleared", () => {
    ensureRetailerAutoResume("222", PAGE_URL);
    markRetailerAutoUserStopped();
    clearRetailerAutoUserStopped();
    startRetailerAutoResume("222", PAGE_URL);
    expect(shouldResumeRetailerAuto(PAGE_URL)?.channel_id).toBe("222");
  });

  it("transitions to checkout phase", () => {
    startRetailerAutoResume("222", PAGE_URL);
    transitionRetailerAutoResumeToCheckout("222", PAGE_URL);
    const resume = readRetailerAutoResume();
    expect(resume?.phase).toBe("checkout");
    expect(resume?.auto_checkout_enabled).toBe(true);
    expect(shouldResumeRetailerCheckout("https://www.target.com/checkout/start")).not.toBeNull();
    expect(shouldResumeRetailerAuto(PAGE_URL)).toBeNull();
  });

  it("parses legacy resume without phase as pdp", () => {
    sessionStorage.setItem(
      "cookiescripts:retailerAutoResume",
      JSON.stringify({
        channel_id: "222",
        product_path: productPathFromUrl(PAGE_URL),
        last_refresh_at: Date.now(),
      }),
    );
    const resume = readRetailerAutoResume();
    expect(resume?.phase).toBe("pdp");
    expect(resume?.auto_checkout_enabled).toBe(false);
  });
});
