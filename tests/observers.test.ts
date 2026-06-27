// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { attachMessagePipeline } from "@ext/content/observers.ts";
import { MESSAGE_ARTICLE } from "@ext/content/selectors.ts";

function makeMessageList(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "messagesWrapper";
  const scroller = document.createElement("div");
  scroller.className = "scroller";
  wrapper.appendChild(scroller);
  document.body.appendChild(wrapper);
  return scroller;
}

function makeMessage(id: string, text: string): HTMLElement {
  const article = document.createElement("div");
  article.className = "message";
  article.setAttribute("role", "article");
  article.id = `chat-messages-${id}`;
  article.textContent = text;
  return article;
}

describe("attachMessagePipeline", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls onListReady with existing messages before observing new ones", () => {
    const list = makeMessageList();
    const existing = makeMessage("111", "https://example.com/old");
    list.appendChild(existing);

    const onListReady = vi.fn();
    const onMessageAdded = vi.fn();
    attachMessagePipeline(onMessageAdded, onListReady);

    expect(onListReady).toHaveBeenCalledWith(list);
    expect(onMessageAdded).not.toHaveBeenCalled();
  });

  it("notifies onMessageAdded for messages added after attach", async () => {
    const list = makeMessageList();
    const onMessageAdded = vi.fn();
    attachMessagePipeline(onMessageAdded);

    const article = makeMessage("222", "https://example.com/new");
    list.appendChild(article);

    await vi.waitFor(() => {
      expect(onMessageAdded).toHaveBeenCalledWith(article);
    });
  });

  it("discovers the message list when it appears later", async () => {
    const onListReady = vi.fn();
    const onMessageAdded = vi.fn();
    attachMessagePipeline(onMessageAdded, onListReady);

    const list = makeMessageList();
    await vi.waitFor(() => {
      expect(onListReady).toHaveBeenCalledWith(list);
    });

    const article = makeMessage("333", "hello");
    list.appendChild(article);
    await vi.waitFor(() => {
      expect(onMessageAdded).toHaveBeenCalledWith(article);
    });
  });
});
