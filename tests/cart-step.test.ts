/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";

import {
  cartCountIncreased,
  dismissCartAddFailureModal,
  hasCartAddFailureUi,
  hasCartAddSuccessUi,
  isCartConfirmed,
  parseCartCount,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";
import * as dom from "@ext/lib/retailer/dom.ts";

describe("cart-step", () => {
  it("parses cart counts from text and aria-label", () => {
    expect(parseCartCount("3 items")).toBe(3);
    expect(parseCartCount("cart 0 items")).toBe(0);
    expect(parseCartCount("cart 1 item")).toBe(1);
    expect(parseCartCount("Cart")).toBeNull();
  });

  it("detects cart count increases", () => {
    expect(cartCountIncreased(0, 1, 1)).toBe(true);
    expect(cartCountIncreased(2, 2, 1)).toBe(false);
  });

  it("reads empty-cart count from aria-label when text is blank", () => {
    document.body.innerHTML = `
      <a data-test="@web/CartLink" aria-label="cart 0 items" href="/cart">
        <div data-test="@web/CartIcon"></div>
      </a>
    `;
    expect(readCartCountFromDocument(document)).toBe(0);
  });

  it("reads cart count from quantity badge", () => {
    document.body.innerHTML = `
      <a data-test="@web/CartLink" aria-label="cart 1 item" href="/cart">
        <span data-test="@web/CartLinkQuantity">1</span>
      </a>
    `;
    expect(readCartCountFromDocument(document)).toBe(1);
  });

  it("detects add-to-cart success modal and sticky in-cart state", () => {
    document.body.innerHTML = `
      <div data-test="addToCartSuccessModalRecommendations">Added</div>
      <div data-test="StickyAddToCartFulfillmentSection">1 in cart</div>
    `;
    expect(hasCartAddSuccessUi(document)).toBe(true);
    expect(isCartConfirmed(document, 0, 1)).toBe(true);
  });

  it("detects add-to-cart failure modal inside role=dialog", () => {
    document.body.innerHTML = `
      <div role="dialog">
        <h2>Item not added to cart</h2>
        <p>Something went wrong and the item was not added to your cart. Please try again.</p>
      </div>
    `;
    expect(hasCartAddFailureUi(document)).toBe(true);
  });

  it("does not treat success modal as failure", () => {
    document.body.innerHTML = `
      <div data-test="addToCartSuccessModalRecommendations">Added to cart</div>
    `;
    expect(hasCartAddFailureUi(document)).toBe(false);
  });

  it("ignores failure text outside dialog containers", () => {
    document.body.innerHTML = `
      <div>Item not added to cart</div>
    `;
    expect(hasCartAddFailureUi(document)).toBe(false);
  });

  it("dismisses failure modal via close button", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 40,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    document.body.innerHTML = `
      <div role="dialog">
        <h2>Item not added to cart</h2>
        <button aria-label="Close">X</button>
      </div>
    `;
    const activateSpy = vi.spyOn(dom, "activateElement");

    expect(dismissCartAddFailureModal(document)).toBe(true);
    expect(activateSpy).toHaveBeenCalledOnce();

    activateSpy.mockRestore();
  });

  it("detects failure modal via close button ancestor when role=dialog is absent", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 40,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    document.body.innerHTML = `
      <div class="styles_modalOverlay">
        <div class="styles_modalContent">
          <button aria-label="close" class="styles_ndsButtonClose__GCWpq styles_close__JqB5A" type="button">
            <svg viewBox="0 0 24 24"></svg>
          </button>
          <h2>Item not added to cart</h2>
          <p>Something went wrong and the item was not added to your cart.</p>
        </div>
      </div>
    `;
    expect(hasCartAddFailureUi(document)).toBe(true);
    expect(dismissCartAddFailureModal(document)).toBe(true);
  });

  it("detects and dismisses Target live failure drawer (errorContent + ReactModal)", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 40,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    document.body.innerHTML = `
      <div class="ModalDrawer">
        <div class="ReactModal__Overlay">
          <div class="ReactModal__Content" role="dialog" aria-modal="true">
            <h2 data-test="modal-drawer-heading">Item not added to cart</h2>
            <button aria-label="close" class="styles_ndsButtonClose__GCWpq styles_close__JqB5A" type="button">
              <svg viewBox="0 0 24 24"></svg>
            </button>
            <div data-test="errorContent">
              <span>Something went wrong and the item was not added to your cart. Please try again.</span>
            </div>
            <button data-test="errorContent-continueShoppingButton">Continue shopping</button>
          </div>
        </div>
      </div>
    `;
    const activateSpy = vi.spyOn(dom, "activateElement");

    expect(hasCartAddFailureUi(document)).toBe(true);
    expect(dismissCartAddFailureModal(document)).toBe(true);
    expect(activateSpy).toHaveBeenCalledOnce();
    const clicked = activateSpy.mock.calls[0]?.[0] as HTMLElement;
    expect(clicked.getAttribute("aria-label")).toBe("close");

    activateSpy.mockRestore();
  });

  it("returns false when failure dialog has no close button", () => {
    document.body.innerHTML = `
      <div role="dialog">
        <h2>Item not added to cart</h2>
        <button>Continue shopping</button>
      </div>
    `;
    expect(dismissCartAddFailureModal(document)).toBe(false);
  });
});
