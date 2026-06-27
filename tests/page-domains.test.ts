// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { filterSuggestibleDomains, scanPageDomains } from "@ext/content/page-domains.ts";

function buildMessageList(html: string): Element {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper;
}

describe("scanPageDomains", () => {
  it("collects unique domains from message links", () => {
    const root = buildMessageList(`
      <div role="article" class="message">
        <a href="https://www.walmart.com/deal">deal</a>
        <a href="https://target.com/item">item</a>
      </div>
      <div role="article" class="message">
        <a href="https://walmart.com/other">other</a>
      </div>
    `);

    expect(scanPageDomains(root)).toEqual(["target.com", "walmart.com"]);
  });

  it("canonicalizes walmart affiliate and image hosts", () => {
    const root = buildMessageList(`
      <div role="article" class="message">
        <a href="https://goto.walmart.com/c/1?u=https%3A%2F%2Fwww.walmart.com%2Fip%2Fitem">deal</a>
        <a href="https://i5.walmartimages.com/asr/abc.jpeg">image</a>
      </div>
    `);

    expect(scanPageDomains(root)).toEqual(["walmart.com"]);
  });

  it("skips discord links and own messages", () => {
    const root = buildMessageList(`
      <div role="article" class="message local">
        <a href="https://walmart.com/hidden">hidden</a>
      </div>
      <div role="article" class="message">
        <a href="https://discord.com/channels/1/2">discord</a>
        <a href="https://bestbuy.com/tv">tv</a>
      </div>
    `);

    expect(scanPageDomains(root)).toEqual(["bestbuy.com"]);
  });

  it("filters scene7, shorteners, and maps affiliate links to retailers", () => {
    const root = buildMessageList(`
      <div role="article" class="message">
        <a href="https://target.scene7.com/is/image/Target/product">image</a>
        <a href="https://howl.link/abc">howl</a>
        <a href="https://mavely.app.link/e/xyz">mavely</a>
        <a href="https://goto.target.com/c/1?u=https%3A%2F%2Fwww.target.com%2Fp%2Fitem">deal</a>
      </div>
    `);

    expect(scanPageDomains(root)).toEqual(["target.com"]);
  });
});

describe("filterSuggestibleDomains", () => {
  it("removes allowed and ignored domains", () => {
    const result = filterSuggestibleDomains(
      ["walmart.com", "target.com", "bestbuy.com"],
      ["walmart.com"],
      ["bestbuy.com"],
    );
    expect(result).toEqual(["target.com"]);
  });
});
