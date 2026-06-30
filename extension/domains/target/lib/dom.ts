const ADD_TO_CART_TEXT = /add to cart|ship it/i;

export function isElementActionable(element: HTMLElement): boolean {
  if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLOptionElement) &&
    element.disabled
  ) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function queryActionable(
  selectors: string[],
  root: ParentNode = document,
): HTMLElement | null {
  for (const selector of selectors) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = root.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const node of nodes) {
      if (node instanceof HTMLElement && isElementActionable(node)) {
        return node;
      }
    }
  }

  const buttons = root.querySelectorAll("button");
  for (const node of buttons) {
    if (!(node instanceof HTMLElement) || !isElementActionable(node)) {
      continue;
    }
    const text = node.textContent?.trim() ?? "";
    const aria = node.getAttribute("aria-label") ?? "";
    if (ADD_TO_CART_TEXT.test(text) || ADD_TO_CART_TEXT.test(aria)) {
      return node;
    }
  }

  return null;
}

export function activateElement(element: HTMLElement): void {
  element.scrollIntoView({ block: "center", inline: "center" });
  element.focus({ preventScroll: true });
  element.dispatchEvent(
    new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }),
  );
  element.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }),
  );
  element.click();
  element.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }),
  );
  element.dispatchEvent(
    new MouseEvent("pointerup", { bubbles: true, cancelable: true, view: window }),
  );
}
