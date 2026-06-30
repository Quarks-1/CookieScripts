/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildQuantityStatusFields,
  clearPageQuantityApplied,
  ensurePageQuantityBeforeAtc,
  isEffectiveUseMax,
  isQuantityInvalid,
  readCurrentPageQuantity,
  readPurchaseLimitFromNextData,
  readPurchaseLimitFromNextDataText,
  readPurchaseLimitFromVisibleOptions,
  readPurchaseLimitForStatus,
  resolveEffectiveQuantity,
  setPageQuantity,
} from "@ext/domains/target/lib/quantity-limit.ts";

const NEXT_DATA_FIXTURE = {
  props: {
    pageProps: {
      product: {
        tcin: "95298174",
        purchase_limit: 2,
      },
    },
  },
};

const MARKETPLACE_NEXT_DATA_FIXTURE = {
  props: {
    dehydratedState: {
      queries: [
        {
          state: {
            data: {
              data: {
                product: {
                  item: {
                    fulfillment: {
                      purchase_limit: 20,
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  },
};

function installNextDataFixture(fixture: object = NEXT_DATA_FIXTURE): void {
  const script = document.createElement("script");
  script.id = "__NEXT_DATA__";
  script.textContent = JSON.stringify(fixture);
  document.head.appendChild(script);
}

describe("quantity-limit", () => {
  beforeEach(() => {
    clearPageQuantityApplied();
  });

  it("reads purchase_limit from __NEXT_DATA__", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    installNextDataFixture();
    expect(readPurchaseLimitFromNextData(document)).toBe(2);
  });

  it("reads purchase_limit from marketplace dehydrated __NEXT_DATA__", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    installNextDataFixture(MARKETPLACE_NEXT_DATA_FIXTURE);
    expect(readPurchaseLimitFromNextData(document)).toBe(20);
  });

  it("returns null when __NEXT_DATA__ tcin does not match the page URL", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    installNextDataFixture();
    expect(
      readPurchaseLimitFromNextData(
        document,
        "https://www.target.com/p/other/-/A-99999999",
      ),
    ).toBeNull();
  });

  it("reads purchase_limit from __NEXT_DATA__ text via regex fallback", () => {
    expect(
      readPurchaseLimitFromNextDataText(
        '{"product":{"item":{"fulfillment":{"purchase_limit":20}}}}',
      ),
    ).toBe(20);
  });

  it("reads purchase_limit from visible qty options without opening dropdown", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button" aria-controls="qty-listbox" aria-expanded="true">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div id="qty-listbox" role="listbox">
        <div role="option">1</div>
        <div role="option">20</div>
      </div>
      <div role="option">99</div>
    `;
    expect(readPurchaseLimitFromVisibleOptions(document)).toBe(20);
    expect(readPurchaseLimitForStatus(document)).toBe(20);
  });

  it("ignores document-wide options outside the qty listbox", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div role="option">99</div>
    `;
    expect(readPurchaseLimitFromVisibleOptions(document)).toBeNull();
  });

  it("resolves effective quantity with max override", () => {
    expect(
      resolveEffectiveQuantity({
        quantity: 1,
        useMaxQuantity: true,
        purchaseLimit: 2,
      }),
    ).toBe(2);
    expect(
      resolveEffectiveQuantity({
        quantity: 5,
        useMaxQuantity: false,
        purchaseLimit: 2,
      }),
    ).toBe(5);
  });

  it("detects invalid quantity unless max override is effective", () => {
    expect(isQuantityInvalid(3, 2, false)).toBe(true);
    expect(isQuantityInvalid(3, 2, true)).toBe(false);
    expect(isEffectiveUseMax(true, null)).toBe(false);
    expect(isEffectiveUseMax(true, 2)).toBe(true);
  });

  it("builds status fields for invalid quantity", () => {
    expect(buildQuantityStatusFields(3, false, 2)).toEqual({
      retailer_quantity_invalid: true,
      retailer_auto_start_blocked: true,
    });
    expect(buildQuantityStatusFields(3, true, 2)).toEqual({
      retailer_quantity_invalid: false,
      retailer_auto_start_blocked: false,
    });
  });

  it("sets page quantity from dropdown options", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button" aria-controls="qty-listbox" aria-expanded="false">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div id="qty-listbox" role="listbox" aria-hidden="true">
        <div role="option">1</div>
        <div role="option" id="qty-2">2</div>
      </div>
    `;
    const valueEl = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] div');
    document.getElementById("qty-2")?.addEventListener("click", () => {
      if (valueEl) {
        valueEl.textContent = "2";
      }
    });

    const result = await setPageQuantity(document, 2);
    expect(result).toEqual({ ok: true });
    expect(document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] div')?.textContent).toBe(
      "2",
    );
  });

  it("sets quantity on main and sticky fulfillment controls", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button" id="main-qty" aria-controls="qty-listbox" aria-expanded="false">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div data-test="StickyAddToCartFulfillmentSection">
        <button type="button" id="sticky-qty" aria-controls="qty-listbox" aria-expanded="false">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div id="qty-listbox" role="listbox" aria-hidden="true">
        <div role="option" id="qty-3">3</div>
      </div>
    `;
    const mainValue = document.querySelector("#main-qty div");
    const stickyValue = document.querySelector("#sticky-qty div");
    document.getElementById("qty-3")?.addEventListener("click", () => {
      if (mainValue) {
        mainValue.textContent = "3";
      }
      if (stickyValue) {
        stickyValue.textContent = "3";
      }
    });

    const result = await setPageQuantity(document, 3);
    expect(result).toEqual({ ok: true });
    expect(mainValue?.textContent).toBe("3");
    expect(stickyValue?.textContent).toBe("3");
  });

  it("waits for qty options to appear after opening the dropdown", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button" id="delayed-qty">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
    `;
    const button = document.getElementById("delayed-qty");
    const valueEl = button?.querySelector("div");
    button?.addEventListener("click", () => {
      globalThis.setTimeout(() => {
        const option = document.createElement("div");
        option.setAttribute("role", "option");
        option.id = "delayed-opt-2";
        option.textContent = "2";
        option.addEventListener("click", () => {
          if (valueEl) {
            valueEl.textContent = "2";
          }
        });
        document.body.appendChild(option);
      }, 80);
    });

    const result = await setPageQuantity(document, 2);
    expect(result).toEqual({ ok: true });
    expect(valueEl?.textContent).toBe("2");
  });

  it("returns failure when qty option is missing", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
    `;

    await expect(setPageQuantity(document, 3)).resolves.toEqual({
      ok: false,
      reason: "Qty option not found",
    });
  });

  it("reads current page quantity from the Qty control", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button">
          <span>Qty</span>
          <div>3</div>
        </button>
      </div>
    `;

    expect(readCurrentPageQuantity(document)).toBe(3);
  });

  it("ensures page quantity once per product path before ATC", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div role="option" id="qty-2">2</div>
    `;
    const valueEl = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] div');
    document.getElementById("qty-2")?.addEventListener("click", () => {
      if (valueEl) {
        valueEl.textContent = "2";
      }
    });

    const pageUrl = "https://www.target.com/p/foo/-/A-123";

    const first = await ensurePageQuantityBeforeAtc(document, 2, pageUrl);
    expect(first).toEqual({ ok: true });
    expect(readCurrentPageQuantity(document)).toBe(2);

    valueEl!.textContent = "1";
    const second = await ensurePageQuantityBeforeAtc(document, 2, pageUrl);
    expect(second).toEqual({ ok: true });
    expect(readCurrentPageQuantity(document)).toBe(2);
  });

  it("clears applied quantity flag on navigation path change", async () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button type="button">
          <span>Qty</span>
          <div>1</div>
        </button>
      </div>
      <div role="option" id="qty-2">2</div>
    `;
    const valueEl = document.querySelector('[data-test="@web/AddToCart/FulfillmentSection"] div');
    document.getElementById("qty-2")?.addEventListener("click", () => {
      if (valueEl) {
        valueEl.textContent = "2";
      }
    });

    await ensurePageQuantityBeforeAtc(document, 2, "https://www.target.com/p/a/-/A-1");
    valueEl!.textContent = "1";
    clearPageQuantityApplied();

    const afterNav = await ensurePageQuantityBeforeAtc(document, 2, "https://www.target.com/p/b/-/A-2");
    expect(afterNav).toEqual({ ok: true });
    expect(readCurrentPageQuantity(document)).toBe(2);
  });
});
