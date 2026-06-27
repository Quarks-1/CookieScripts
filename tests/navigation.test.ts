// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { hookSpaNavigation } from "@ext/content/navigation.ts";

describe("hookSpaNavigation", () => {
  let teardown: (() => void) | null = null;

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.useRealTimers();
  });

  it("calls callback after pushState", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    teardown = hookSpaNavigation(onNavigate);

    history.pushState({}, "", "/channels/1/2");
    expect(onNavigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("calls callback after replaceState", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    teardown = hookSpaNavigation(onNavigate);

    history.replaceState({}, "", "/channels/1/3");
    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("calls callback on popstate", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    teardown = hookSpaNavigation(onNavigate);

    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("calls callback on bfcache pageshow", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    teardown = hookSpaNavigation(onNavigate);

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("stops calling after teardown", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    teardown = hookSpaNavigation(onNavigate);
    teardown();
    teardown = null;

    history.pushState({}, "", "/channels/9/9");
    vi.advanceTimersByTime(50);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
