const CHECKOUT_ERROR_MODAL_PATTERNS = [
  /high-demand item/i,
  /popular item in your cart/i,
  /managing high traffic/i,
  /please keep trying/i,
] as const;

const CHECKOUT_ERROR_DIALOG_SELECTORS = [
  '.ReactModal__Content[role="dialog"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-test*="modal" i]',
] as const;

const CHECKOUT_ERROR_CLOSE_SELECTORS = [
  'button[aria-label="Close"]',
  'button[aria-label="close"]',
  'button[class*="styles_ndsButtonClose"]',
  'button[class*="styles_close"]',
  'button[data-test*="close" i]',
  'button[data-test*="modalClose" i]',
] as const;

function isCheckoutErrorModalText(text: string): boolean {
  return CHECKOUT_ERROR_MODAL_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesCheckoutErrorDialog(element: HTMLElement): boolean {
  const text = element.textContent ?? "";
  return isCheckoutErrorModalText(text) && text.length <= 4_000;
}

function findCheckoutErrorDialogViaCloseButton(doc: Document): HTMLElement | null {
  for (const selector of CHECKOUT_ERROR_CLOSE_SELECTORS) {
    let buttons: NodeListOf<Element>;
    try {
      buttons = doc.querySelectorAll(selector);
    } catch {
      continue;
    }

    for (const button of buttons) {
      if (!(button instanceof HTMLElement)) {
        continue;
      }

      let el: Element | null = button.parentElement;
      for (let depth = 0; depth < 12 && el != null && el !== doc.body; depth += 1) {
        if (!(el instanceof HTMLElement)) {
          el = el.parentElement;
          continue;
        }
        if (matchesCheckoutErrorDialog(el)) {
          return el;
        }
        el = el.parentElement;
      }
    }
  }

  return null;
}

function findCheckoutErrorDialog(doc: Document): HTMLElement | null {
  const errorContent = doc.querySelector('[data-test="errorContent"]');
  if (errorContent instanceof HTMLElement) {
    const dialog =
      errorContent.closest('[role="dialog"]') ?? errorContent.closest('[aria-modal="true"]');
    if (dialog instanceof HTMLElement && matchesCheckoutErrorDialog(dialog)) {
      return dialog;
    }
    if (matchesCheckoutErrorDialog(errorContent)) {
      return errorContent;
    }
  }

  for (const selector of CHECKOUT_ERROR_DIALOG_SELECTORS) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch {
      continue;
    }

    for (const node of nodes) {
      if (node instanceof HTMLElement && matchesCheckoutErrorDialog(node)) {
        return node;
      }
    }
  }

  return findCheckoutErrorDialogViaCloseButton(doc);
}

export function hasCheckoutErrorModal(doc: Document = document): boolean {
  return findCheckoutErrorDialog(doc) !== null;
}
