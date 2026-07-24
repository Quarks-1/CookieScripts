/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readRetailerAutoResume,
  saveRetailerAutoResume,
  startRetailerAutoResume,
  transitionRetailerAutoResumeToCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";
import {
  clickPlaceOrderOnce,
  createPlaceOrderClickState,
} from "@ext/domains/target/lib/checkout/place-order.ts";
import { runCheckoutStepTick } from "@ext/domains/target/lib/checkout/steps.ts";
import {
  hasCheckoutProgress,
  readCheckoutProgressSnapshot,
  runCheckoutWaitingTick,
} from "@ext/domains/target/lib/checkout/waiting-checkout.ts";

function loadFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "../fixtures", name), "utf8");
}

function mountFixture(name: string): void {
  const html = loadFixture(name);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
}

describe("place-order", () => {
  beforeEach(() => {
    mountFixture("target-checkout-ready.html");
  });

  it("clicks enabled place order at most once", () => {
    const state = createPlaceOrderClickState();
    expect(clickPlaceOrderOnce(state, document)).toBe(true);
    expect(clickPlaceOrderOnce(state, document)).toBe(false);
  });
});

describe("checkout steps", () => {
  it("clicks save and continue on mid-step fixture", () => {
    mountFixture("target-checkout-drop-stuck.html");
    const button = document.querySelector(
      '[data-test^="save_and_continue_button_step_"]',
    ) as HTMLButtonElement;
    const clickSpy = vi.spyOn(button, "click");

    expect(runCheckoutStepTick(document)).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe("waiting-checkout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects checkout progress when shell loads", () => {
    const before = readCheckoutProgressSnapshot(document);
    mountFixture("target-checkout-ready.html");
    const after = readCheckoutProgressSnapshot(document);
    expect(hasCheckoutProgress(before, after)).toBe(true);
  });

  it("returns auth_required after hydration grace when signed out", async () => {
    const base = new Date("2024-01-01T00:00:00Z");
    vi.setSystemTime(base);
    document.body.innerHTML =
      '<div data-test="@web/auth-components/AuthSignInFlyout"></div>';
    const enteredAt = base.getTime();
    vi.setSystemTime(new Date(enteredAt + 3_500));

    const result = await runCheckoutWaitingTick({
      refreshIntervalSec: 30,
      shouldContinue: () => true,
      requestHardReload: async () => {},
      progressSnapshot: readCheckoutProgressSnapshot(document),
      checkoutEnteredAtMs: enteredAt,
    });

    expect(result.kind).toBe("auth_required");
  });

  it("fails fast on auth without waiting for stall refresh", async () => {
    const base = new Date("2024-01-01T00:00:00Z");
    vi.setSystemTime(base);
    startRetailerAutoResume("222", "https://www.target.com/p/foo/-/A-1");
    transitionRetailerAutoResumeToCheckout(
      "222",
      "https://www.target.com/checkout/start",
    );
    document.body.innerHTML =
      '<div data-test="@web/auth-components/AuthSignInFlyout"></div>';
    vi.setSystemTime(new Date(base.getTime() + 5_000));

    const result = await runCheckoutWaitingTick({
      refreshIntervalSec: 0,
      shouldContinue: () => true,
      requestHardReload: async () => {},
      progressSnapshot: readCheckoutProgressSnapshot(document),
      checkoutEnteredAtMs: base.getTime(),
    });

    expect(result.kind).toBe("auth_required");
  });

  it("hard refreshes when high-demand modal is visible and interval elapsed", async () => {
    const base = new Date("2024-01-01T00:00:00Z");
    vi.setSystemTime(base);
    startRetailerAutoResume("222", "https://www.target.com/p/foo/-/A-1");
    transitionRetailerAutoResumeToCheckout(
      "222",
      "https://www.target.com/checkout/start",
    );
    const resume = readRetailerAutoResume();
    expect(resume).not.toBeNull();
    saveRetailerAutoResume({
      ...resume!,
      last_checkout_progress_at: base.getTime() - 5_000,
    });

    mountFixture("target-checkout-high-demand-modal.html");
    vi.setSystemTime(new Date(base.getTime() + 3_500));

    const requestHardReload = vi.fn(async () => {});
    const result = await runCheckoutWaitingTick({
      refreshIntervalSec: 3,
      shouldContinue: () => true,
      requestHardReload,
      progressSnapshot: readCheckoutProgressSnapshot(document),
      checkoutEnteredAtMs: base.getTime(),
    });

    expect(requestHardReload).toHaveBeenCalledOnce();
    expect(result.kind).toBe("reloading");
  });

  it("does not mark checkout progress when shell loads behind error modal", async () => {
    const base = new Date("2024-01-01T00:00:00Z");
    vi.setSystemTime(base);
    startRetailerAutoResume("222", "https://www.target.com/p/foo/-/A-1");
    transitionRetailerAutoResumeToCheckout(
      "222",
      "https://www.target.com/checkout/start",
    );
    saveRetailerAutoResume({
      ...readRetailerAutoResume()!,
      last_checkout_progress_at: base.getTime(),
    });

    mountFixture("target-checkout-high-demand-modal.html");
    const beforeSnapshot = readCheckoutProgressSnapshot(document);
    expect(beforeSnapshot.shellLoaded).toBe(true);

    await runCheckoutWaitingTick({
      refreshIntervalSec: 60,
      shouldContinue: () => true,
      requestHardReload: async () => {},
      progressSnapshot: {
        saveAndContinueCount: 0,
        activeStepHeading: null,
        placeOrderEnabled: false,
        shellLoaded: false,
      },
      checkoutEnteredAtMs: base.getTime(),
    });

    expect(readRetailerAutoResume()?.last_checkout_progress_at).toBe(base.getTime());
  });
});
