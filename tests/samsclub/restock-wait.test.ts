/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { isRestockWaitPage } from "@ext/domains/samsclub/lib/restock-wait.ts";

describe("samsclub restock-wait", () => {
  it("detects disabled main ATC as restock wait", () => {
    document.body.innerHTML = `
      <button data-automation-id="atc" aria-label="Add to Cart - Rattle" disabled>Add to Cart</button>
    `;
    expect(
      isRestockWaitPage(document, "https://www.samsclub.com/ip/Rattle/20186272756"),
    ).toBe(true);
  });

  it("returns false when main ATC is enabled", () => {
    document.body.innerHTML = `
      <button data-automation-id="atc" aria-label="Add to Cart - Rattle">Add to Cart</button>
    `;
    expect(
      isRestockWaitPage(document, "https://www.samsclub.com/ip/Rattle/20186272756"),
    ).toBe(false);
  });

  it("detects pre-drop pages without an ATC button", () => {
    document.body.innerHTML = `
      <main>
        <button>Shop similar</button>
        <p>Drops July 21st</p>
        <p>Shipping Not available</p>
      </main>
    `;

    expect(
      isRestockWaitPage(
        document,
        "https://www.samsclub.com/ip/Rattle/20186272756",
      ),
    ).toBe(true);
  });
});
