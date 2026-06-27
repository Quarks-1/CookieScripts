// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  extractAuthor,
  extractLinksFromMessage,
  getMessageId,
  isOwnMessage,
} from "@ext/content/extract.ts";

describe("getMessageId", () => {
  it("parses snowflake from chat-messages id", () => {
    const el = document.createElement("div");
    el.id = "chat-messages-123456789012345678";
    expect(getMessageId(el)).toBe("123456789012345678");
  });

  it("parses data-list-item-id", () => {
    const el = document.createElement("div");
    el.setAttribute("data-list-item-id", "999888777666555444");
    expect(getMessageId(el)).toBe("999888777666555444");
  });

  it("returns null when no id is available", () => {
    const el = document.createElement("div");
    expect(getMessageId(el)).toBeNull();
  });
});

describe("isOwnMessage", () => {
  it("detects own message via local class", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "message local";
    const inner = document.createElement("span");
    wrapper.appendChild(inner);
    expect(isOwnMessage(inner)).toBe(true);
  });

  it("detects data-is-author attribute", () => {
    const el = document.createElement("div");
    el.setAttribute("data-is-author", "true");
    expect(isOwnMessage(el)).toBe(true);
  });

  it("returns false for other users messages", () => {
    const el = document.createElement("div");
    el.className = "message";
    expect(isOwnMessage(el)).toBe(false);
  });
});

describe("extractAuthor", () => {
  it("reads username element text", () => {
    const root = document.createElement("div");
    const author = document.createElement("span");
    author.className = "username";
    author.textContent = "alice";
    root.appendChild(author);
    expect(extractAuthor(root)).toBe("alice");
  });

  it("returns unknown when author missing", () => {
    expect(extractAuthor(document.createElement("div"))).toBe("unknown");
  });
});

describe("extractLinksFromMessage", () => {
  it("extracts URLs from text content", () => {
    const root = document.createElement("div");
    root.textContent = "Check https://walmart.com/item/123 today";
    expect(extractLinksFromMessage(root)).toEqual(["https://walmart.com/item/123"]);
  });

  it("extracts http(s) hrefs from anchors", () => {
    const root = document.createElement("div");
    const link = document.createElement("a");
    link.href = "https://walmart.com/deal";
    link.textContent = "deal";
    root.appendChild(link);
    expect(extractLinksFromMessage(root)).toEqual(["https://walmart.com/deal"]);
  });

  it("extracts visible text URL alongside discord redirect href", () => {
    const root = document.createElement("div");
    const text = document.createElement("span");
    text.textContent = "See https://walmart.com/product for details";
    root.appendChild(text);
    const link = document.createElement("a");
    link.href = "https://discord.com/channels/1/2";
    link.textContent = "link";
    root.appendChild(link);
    const urls = extractLinksFromMessage(root);
    expect(urls).toContain("https://walmart.com/product");
    expect(urls).toContain("https://discord.com/channels/1/2");
  });

  it("dedupes identical URLs from text and href", () => {
    const root = document.createElement("div");
    root.textContent = "https://walmart.com/x";
    const link = document.createElement("a");
    link.href = "https://walmart.com/x";
    root.appendChild(link);
    expect(extractLinksFromMessage(root)).toEqual(["https://walmart.com/x"]);
  });
});
