// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { extractAnchorsFromMessage } from "@ext/domains/discord/content/extract.ts";

describe("extractAnchorsFromMessage", () => {
  it("returns anchors in DOM order", () => {
    const root = document.createElement("div");
    const first = document.createElement("a");
    first.href = "https://howl.link/abc";
    first.textContent = "Pokemon TCG";
    const second = document.createElement("a");
    second.href = "https://www.target.com/s?searchTerm=95120834";
    second.textContent = "ATC";
    root.append(first, second);

    expect(extractAnchorsFromMessage(root)).toEqual([
      { href: "https://howl.link/abc", text: "Pokemon TCG" },
      { href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" },
    ]);
  });

  it("dedupes by href keeping first occurrence", () => {
    const root = document.createElement("div");
    const first = document.createElement("a");
    first.href = "https://howl.link/abc";
    first.textContent = "Title";
    const duplicate = document.createElement("a");
    duplicate.href = "https://howl.link/abc";
    duplicate.textContent = "Duplicate";
    root.append(first, duplicate);

    expect(extractAnchorsFromMessage(root)).toEqual([
      { href: "https://howl.link/abc", text: "Title" },
    ]);
  });
});
