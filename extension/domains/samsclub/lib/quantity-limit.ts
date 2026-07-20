import { activateElement } from "@ext/domains/samsclub/lib/dom.ts";
import { productPathFromUrl } from "@ext/domains/samsclub/lib/auto-resume.ts";
import { sleep } from "@ext/core/lib/sleep.ts";

const FULFILLMENT_SECTION = '[data-test="@web/AddToCart/FulfillmentSection"]';
const STICKY_FULFILLMENT_SECTION = '[data-test="StickyAddToCartFulfillmentSection"]';
const QTY_SCOPE_SELECTORS = [FULFILLMENT_SECTION, STICKY_FULFILLMENT_SECTION] as const;
const PRODUCT_CONTEXT_KEYS = new Set(["product", "item", "fulfillment"]);
const PAGE_QTY_SETTLE_MS = 500;
const QTY_OPTIONS_TIMEOUT_MS = 2_000;
const QTY_OPTIONS_POLL_MS = 50;
const QTY_VERIFY_TIMEOUT_MS = 2_500;
const QTY_VERIFY_POLL_MS = 100;

let appliedPageQuantity: { path: string; quantity: number } | null = null;

export function clearPageQuantityApplied(): void {
  appliedPageQuantity = null;
}

export type EffectiveQuantityInput = {
  quantity: number;
  useMaxQuantity: boolean;
  purchaseLimit: number | null;
};

export function isEffectiveUseMax(useMaxQuantity: boolean, purchaseLimit: number | null): boolean {
  return useMaxQuantity && purchaseLimit != null;
}

export function isQuantityInvalid(
  quantity: number,
  purchaseLimit: number | null,
  useMaxQuantity: boolean,
): boolean {
  const effectiveUseMax = isEffectiveUseMax(useMaxQuantity, purchaseLimit);
  return purchaseLimit != null && !effectiveUseMax && quantity > purchaseLimit;
}

export function resolveEffectiveQuantity(input: EffectiveQuantityInput): number {
  const { quantity, useMaxQuantity, purchaseLimit } = input;
  if (isEffectiveUseMax(useMaxQuantity, purchaseLimit) && purchaseLimit != null) {
    return purchaseLimit;
  }
  return quantity;
}

export function parseTcinFromProductUrl(url: string): string | null {
  const match = url.match(/\/A-(\d+)(?:\b|[/?#]|$)/);
  return match?.[1] ?? null;
}

function nextDataMatchesPageTcin(text: string, pageUrl: string): boolean {
  const tcin = parseTcinFromProductUrl(pageUrl);
  if (!tcin) {
    return true;
  }
  return (
    text.includes(`"tcin":"${tcin}"`) ||
    text.includes(`"tcin": "${tcin}"`) ||
    text.includes(`"tcin":${tcin}`)
  );
}

function parsePurchaseLimitValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const limit = Math.floor(raw);
    return limit >= 1 ? limit : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const limit = Math.floor(Number(raw));
    return Number.isFinite(limit) && limit >= 1 ? limit : null;
  }
  return null;
}

function isProductShapedObject(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.tcin === "string" || parsePurchaseLimitValue(record.purchase_limit) != null;
}

function findPurchaseLimitInValue(value: unknown, underProduct = false): number | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPurchaseLimitInValue(item, underProduct);
      if (found != null) {
        return found;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const nextUnderProduct = underProduct || record.product != null || isProductShapedObject(record);

  if (nextUnderProduct && "purchase_limit" in record) {
    const limit = parsePurchaseLimitValue(record.purchase_limit);
    if (limit != null) {
      return limit;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    const childUnderProduct = nextUnderProduct || PRODUCT_CONTEXT_KEYS.has(key);
    const found = findPurchaseLimitInValue(child, childUnderProduct);
    if (found != null) {
      return found;
    }
  }

  return null;
}

export function readPurchaseLimitFromNextDataText(text: string): number | null {
  const limits: number[] = [];
  for (const match of text.matchAll(/"purchase_limit"\s*:\s*(\d+)/g)) {
    const limit = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(limit) && limit >= 1) {
      limits.push(limit);
    }
  }
  if (limits.length === 0) {
    return null;
  }
  return Math.max(...limits);
}

export function readPurchaseLimitFromNextData(doc: Document, pageUrl?: string): number | null {
  const script = doc.getElementById("__NEXT_DATA__");
  if (!script?.textContent) {
    return null;
  }

  const text = script.textContent;
  const href = pageUrl ?? doc.defaultView?.location?.href ?? "";
  if (href && !nextDataMatchesPageTcin(text, href)) {
    return null;
  }

  try {
    const fromJson = findPurchaseLimitInValue(JSON.parse(text));
    if (fromJson != null) {
      return fromJson;
    }
  } catch {
    // Fall through to regex scan.
  }

  return readPurchaseLimitFromNextDataText(text);
}

function findQtyButton(scope: ParentNode): HTMLButtonElement | null {
  const buttons = scope.querySelectorAll("button");
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    const label = button.querySelector("span");
    if (label?.textContent?.trim() === "Qty") {
      return button;
    }
    const aria = button.getAttribute("aria-label") ?? "";
    if (/quantity/i.test(aria)) {
      return button;
    }
    const compactText = (button.textContent ?? "").replace(/\s+/g, "");
    if (/^Qty\d+$/i.test(compactText)) {
      return button;
    }
  }
  return null;
}

function findQtyButtons(doc: Document): HTMLButtonElement[] {
  const buttons: HTMLButtonElement[] = [];
  for (const selector of QTY_SCOPE_SELECTORS) {
    const scope = doc.querySelector(selector);
    if (!scope) {
      continue;
    }
    const button = findQtyButton(scope);
    if (button) {
      buttons.push(button);
    }
  }
  return buttons;
}

function readQtyButtonValue(button: HTMLButtonElement): number | null {
  for (const child of button.children) {
    if (child instanceof HTMLElement && child.tagName === "DIV") {
      const value = Number.parseInt(child.textContent?.trim() ?? "", 10);
      if (Number.isFinite(value) && value >= 1) {
        return value;
      }
    }
  }

  const text = button.textContent?.trim() ?? "";
  const fromText = text.match(/Qty\s*(\d+)/i);
  if (fromText?.[1]) {
    const value = Number.parseInt(fromText[1], 10);
    if (Number.isFinite(value) && value >= 1) {
      return value;
    }
  }

  return null;
}

function closeQtyDropdown(doc: Document): void {
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function findOpenQtyListbox(doc: Document, button: HTMLButtonElement): HTMLElement | null {
  const controlsId = button.getAttribute("aria-controls");
  if (controlsId) {
    const controlled = doc.getElementById(controlsId);
    if (controlled instanceof HTMLElement) {
      return controlled;
    }
  }

  for (const listbox of doc.querySelectorAll('[role="listbox"]')) {
    if (!(listbox instanceof HTMLElement)) {
      continue;
    }
    if (listbox.getAttribute("aria-hidden") === "true") {
      continue;
    }
    return listbox;
  }

  return null;
}

async function waitForButtonExpanded(
  button: HTMLButtonElement,
  expanded: boolean,
  deadlineMs: number,
): Promise<boolean> {
  if (button.getAttribute("aria-expanded") == null) {
    return true;
  }

  const expected = expanded ? "true" : "false";
  while (Date.now() < deadlineMs) {
    if (button.getAttribute("aria-expanded") === expected) {
      return true;
    }
    await sleep(QTY_OPTIONS_POLL_MS);
  }
  return button.getAttribute("aria-expanded") === expected;
}

function findQtyOptionElement(
  doc: Document,
  quantity: number,
  root?: ParentNode | null,
): HTMLElement | null {
  const scope = root ?? doc;
  for (const option of scope.querySelectorAll('[role="option"]')) {
    if (!(option instanceof HTMLElement)) {
      continue;
    }
    const text = option.textContent?.trim() ?? "";
    const value = Number.parseInt(text, 10);
    if (value === quantity) {
      return option;
    }
  }
  return null;
}

async function waitForQtyOptionElement(
  doc: Document,
  quantity: number,
  deadlineMs: number,
  root?: ParentNode | null,
): Promise<HTMLElement | null> {
  while (Date.now() < deadlineMs) {
    const scoped = root ? findQtyOptionElement(doc, quantity, root) : null;
    const option = scoped ?? findQtyOptionElement(doc, quantity);
    if (option) {
      return option;
    }
    await sleep(QTY_OPTIONS_POLL_MS);
  }
  const scoped = root ? findQtyOptionElement(doc, quantity, root) : null;
  return scoped ?? findQtyOptionElement(doc, quantity);
}

async function waitForButtonQuantity(
  button: HTMLButtonElement,
  quantity: number,
  deadlineMs: number,
): Promise<boolean> {
  while (Date.now() < deadlineMs) {
    if (readQtyButtonValue(button) === quantity) {
      return true;
    }
    await sleep(QTY_VERIFY_POLL_MS);
  }
  return readQtyButtonValue(button) === quantity;
}

function allQtyButtonsMatch(doc: Document, quantity: number): boolean {
  const buttons = findQtyButtons(doc);
  if (buttons.length === 0) {
    return quantity === 1;
  }
  return buttons.every((button) => readQtyButtonValue(button) === quantity);
}

async function waitForAllQtyButtons(
  doc: Document,
  quantity: number,
  deadlineMs: number,
): Promise<boolean> {
  while (Date.now() < deadlineMs) {
    if (allQtyButtonsMatch(doc, quantity)) {
      return true;
    }
    await sleep(QTY_VERIFY_POLL_MS);
  }
  return allQtyButtonsMatch(doc, quantity);
}

export function readCurrentPageQuantity(doc: Document): number | null {
  const mainScope = doc.querySelector(FULFILLMENT_SECTION);
  if (mainScope) {
    const mainButton = findQtyButton(mainScope);
    if (mainButton) {
      return readQtyButtonValue(mainButton);
    }
  }

  const buttons = findQtyButtons(doc);
  if (buttons.length === 0) {
    return null;
  }
  return readQtyButtonValue(buttons[0]!);
}

function readOptionValues(root: ParentNode): number[] {
  const values: number[] = [];
  for (const option of root.querySelectorAll('[role="option"]')) {
    const text = option.textContent?.trim() ?? "";
    const value = Number.parseInt(text, 10);
    if (Number.isFinite(value) && value >= 1) {
      values.push(value);
    }
  }
  return values;
}

function readPurchaseLimitFromOpenListbox(
  doc: Document,
  scope: ParentNode,
): number | null {
  const button = findQtyButton(scope);
  if (!button) {
    return null;
  }

  const listbox = findOpenQtyListbox(doc, button);
  if (!listbox) {
    return null;
  }

  const values = readOptionValues(listbox);
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

/** Reads max qty from open dropdown options without clicking (status-safe). */
export function readPurchaseLimitFromVisibleOptions(doc: Document): number | null {
  const limits: number[] = [];
  for (const selector of QTY_SCOPE_SELECTORS) {
    const scope = doc.querySelector(selector);
    if (!scope) {
      continue;
    }
    const limit = readPurchaseLimitFromOpenListbox(doc, scope);
    if (limit != null) {
      limits.push(limit);
    }
  }
  if (limits.length === 0) {
    return null;
  }
  return Math.max(...limits);
}

export function readPurchaseLimitFromDom(doc: Document): number | null {
  const limits: number[] = [];
  for (const selector of QTY_SCOPE_SELECTORS) {
    const scope = doc.querySelector(selector);
    if (!scope) {
      continue;
    }
    const button = findQtyButton(scope);
    if (!button) {
      continue;
    }

    activateElement(button);
    const listbox = findOpenQtyListbox(doc, button);
    const values = listbox ? readOptionValues(listbox) : [];
    closeQtyDropdown(doc);

    if (values.length > 0) {
      limits.push(Math.max(...values));
    }
  }
  if (limits.length === 0) {
    return null;
  }
  return Math.max(...limits);
}

export function readPurchaseLimitForStatus(doc: Document): number | null {
  return (
    readPurchaseLimitFromNextData(doc) ?? readPurchaseLimitFromVisibleOptions(doc)
  );
}

export function readPurchaseLimitForAutomation(doc: Document): number | null {
  return readPurchaseLimitFromNextData(doc) ?? readPurchaseLimitFromDom(doc);
}

export type SetPageQuantityResult = { ok: true } | { ok: false; reason: string };

async function setPageQuantityOnButton(
  doc: Document,
  button: HTMLButtonElement,
  quantity: number,
): Promise<SetPageQuantityResult> {
  if (readQtyButtonValue(button) === quantity) {
    return { ok: true };
  }

  activateElement(button);

  const optionsDeadline = Date.now() + QTY_OPTIONS_TIMEOUT_MS;
  await waitForButtonExpanded(button, true, optionsDeadline);

  const listbox = findOpenQtyListbox(doc, button);
  const option = await waitForQtyOptionElement(
    doc,
    quantity,
    optionsDeadline,
    listbox,
  );
  if (!option) {
    closeQtyDropdown(doc);
    return { ok: false, reason: "Qty option not found" };
  }

  activateElement(option);
  await waitForButtonExpanded(button, false, Date.now() + QTY_VERIFY_TIMEOUT_MS);
  closeQtyDropdown(doc);

  const updated = await waitForButtonQuantity(
    button,
    quantity,
    Date.now() + QTY_VERIFY_TIMEOUT_MS,
  );
  if (!updated) {
    return { ok: false, reason: "Qty value did not update" };
  }

  return { ok: true };
}

export async function setPageQuantity(
  doc: Document,
  quantity: number,
): Promise<SetPageQuantityResult> {
  const targetQty = Math.max(1, Math.floor(quantity));
  const buttons = findQtyButtons(doc);
  if (buttons.length === 0) {
    if (targetQty === 1) {
      return { ok: true };
    }
    return { ok: false, reason: "Qty control not found" };
  }

  for (const button of buttons) {
    const result = await setPageQuantityOnButton(doc, button, targetQty);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

export async function ensurePageQuantityBeforeAtc(
  doc: Document,
  quantity: number,
  pageUrl?: string,
): Promise<SetPageQuantityResult> {
  const path = productPathFromUrl(pageUrl ?? doc.defaultView?.location?.href ?? "");
  const targetQty = Math.max(1, Math.floor(quantity));

  if (
    appliedPageQuantity?.path === path &&
    appliedPageQuantity.quantity === targetQty &&
    allQtyButtonsMatch(doc, targetQty)
  ) {
    return { ok: true };
  }

  if (allQtyButtonsMatch(doc, targetQty)) {
    appliedPageQuantity = { path, quantity: targetQty };
    return { ok: true };
  }

  const result = await setPageQuantity(doc, targetQty);
  if (!result.ok) {
    return result;
  }

  const stable = await waitForAllQtyButtons(
    doc,
    targetQty,
    Date.now() + QTY_VERIFY_TIMEOUT_MS,
  );
  if (!stable) {
    return { ok: false, reason: "Qty value did not stabilize" };
  }

  await sleep(PAGE_QTY_SETTLE_MS);
  appliedPageQuantity = { path, quantity: targetQty };
  return { ok: true };
}

export function buildQuantityStatusFields(
  quantity: number,
  useMaxQuantity: boolean,
  purchaseLimit: number | null,
): {
  samsclub_quantity_invalid: boolean;
  samsclub_auto_start_blocked: boolean;
} {
  const invalid = isQuantityInvalid(quantity, purchaseLimit, useMaxQuantity);
  return {
    samsclub_quantity_invalid: invalid,
    samsclub_auto_start_blocked: invalid,
  };
}
