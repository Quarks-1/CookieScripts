/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";

import {
  findReactInputHandlers,
  hasReactInputHandlers,
  tryFillViaReactHandlers,
} from "@ext/domains/samsclub/lib/checkout/react-input.ts";

describe("samsclub react-input", () => {
  it("finds onChange on react props bag", () => {
    const input = document.createElement("input");
    const onChange = vi.fn();
    Object.defineProperty(input, "__reactProps$abc", {
      value: { onChange },
      enumerable: false,
    });
    document.body.innerHTML = "";
    document.body.append(input);

    const match = findReactInputHandlers(input);
    expect(match).not.toBeNull();
    expect(hasReactInputHandlers(input)).toBe(true);
  });

  it("fills via per-digit onChange", () => {
    const input = document.createElement("input");
    const onChange = vi.fn((event: { target: HTMLInputElement }) => {
      const next = event.target.value;
      input.value = /^\d{0,3}$/.test(next) ? next : "";
    });
    Object.defineProperty(input, "__reactProps$abc", {
      value: { onChange },
      enumerable: false,
    });
    document.body.innerHTML = "";
    document.body.append(input);

    expect(tryFillViaReactHandlers(input, "439")).toBe(true);
    expect(input.value).toBe("439");
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("walks parent elements for react handlers", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    const onChange = vi.fn();
    Object.defineProperty(wrapper, "__reactProps$wrap", {
      value: { onChange },
      enumerable: false,
    });
    wrapper.append(input);
    document.body.innerHTML = "";
    document.body.append(wrapper);

    expect(findReactInputHandlers(input)?.element).toBe(wrapper);
    expect(tryFillViaReactHandlers(input, "789")).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });
});
