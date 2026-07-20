import { isElementActionable } from "@ext/domains/samsclub/lib/dom.ts";
import { CHECKOUT_CVV_INPUT_SELECTOR, PLACE_ORDER_BUTTON_SELECTOR } from "@ext/domains/samsclub/lib/checkout/selectors.ts";
import {
  isCheckoutPageLoading,
  isSamsclubReviewOrderUrl,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { normalizeSamsclubCheckoutCvv } from "@ext/domains/samsclub/lib/channel-config.ts";
import { tryFillViaReactHandlers, findReactInputHandlers } from "@ext/domains/samsclub/lib/checkout/react-input.ts";
import { sleep } from "@ext/core/lib/sleep.ts";

export type FillCheckoutCvvResult =
  | "filled"
  | "already_set"
  | "pending_validation"
  | "missing_field"
  | "invalid_cvv";

export const CVV_CHAR_DELAY_MS = 80;
export const CVV_POST_TYPE_SETTLE_MS = 600;
export const POST_CVV_READY_POLL_MS = 50;
export const POST_CVV_READY_TIMEOUT_MS = 8_000;
/** Consecutive satisfied polls before Place order (avoids racing React validation). */
export const POST_CVV_STABLE_POLLS_REQUIRED = 6;

const CVV_VALIDATION_ERROR_TEXT =
  /enter the 3.?digit code|security code on the back|please correct the errors below/i;
const CVV_PROMPT_TEXT = /cvv\s*\(required\)/i;

function isPlaceOrderEnabled(doc: Document): boolean {
  const button = doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR);
  return button instanceof HTMLButtonElement && !button.disabled;
}

function resolveCheckoutPageUrl(pageUrl?: string): string {
  if (pageUrl != null) {
    return pageUrl;
  }
  return typeof location !== "undefined" ? location.href : "";
}

function isReviewOrderCheckout(pageUrl?: string): boolean {
  return isSamsclubReviewOrderUrl(resolveCheckoutPageUrl(pageUrl));
}

export function isCheckoutCvvPromptVisible(doc: Document = document): boolean {
  if (doc.querySelector('label[for="cvv-field"], [data-automation-id*="cvv" i], [data-testid*="cvv" i]')) {
    return true;
  }
  for (const label of doc.querySelectorAll("label")) {
    if (CVV_PROMPT_TEXT.test(label.textContent ?? "")) {
      return true;
    }
  }
  return CVV_PROMPT_TEXT.test(doc.body?.textContent ?? "");
}

export function hasCheckoutFormErrors(doc: Document = document): boolean {
  for (const alert of doc.querySelectorAll('[role="alert"]')) {
    if (alert.id === "__next-route-announcer__") {
      continue;
    }
    const text = alert.textContent ?? "";
    if (CVV_VALIDATION_ERROR_TEXT.test(text)) {
      return true;
    }
  }
  return false;
}

function collectCheckoutCvvInputCandidates(doc: Document): HTMLInputElement[] {
  const seen = new Set<HTMLInputElement>();
  const add = (input: HTMLInputElement | null) => {
    if (input && !seen.has(input)) {
      seen.add(input);
    }
  };

  for (const el of doc.querySelectorAll(CHECKOUT_CVV_INPUT_SELECTOR)) {
    if (el instanceof HTMLInputElement) {
      add(el);
    }
  }

  for (const label of doc.querySelectorAll("label")) {
    if (!CVV_PROMPT_TEXT.test(label.textContent ?? "")) {
      continue;
    }
    const forId = label.getAttribute("for");
    if (forId) {
      const linked = doc.getElementById(forId);
      if (linked instanceof HTMLInputElement) {
        add(linked);
      }
    }
    for (const nested of label.querySelectorAll("input")) {
      if (nested instanceof HTMLInputElement) {
        add(nested);
      }
    }
  }

  return [...seen];
}

export function probeCheckoutCvvCandidates(doc: Document = document): Array<{
  id: string;
  name: string;
  type: string;
  maxlength: string;
  actionable: boolean;
  valueLength: number;
  ariaInvalid: boolean;
}> {
  return collectCheckoutCvvInputCandidates(doc).map((el) => ({
    id: el.id,
    name: el.name,
    type: el.type,
    maxlength: el.getAttribute("maxlength") ?? "",
    actionable: isCheckoutCvvInputVisible(el),
    valueLength: el.value.trim().length,
    ariaInvalid: el.getAttribute("aria-invalid") === "true",
  }));
}

export function findCheckoutCvvInput(doc: Document = document): HTMLInputElement | null {
  const candidates = collectCheckoutCvvInputCandidates(doc);
  for (const input of candidates) {
    if (isCheckoutCvvInputVisible(input)) {
      return input;
    }
  }
  return candidates[0] ?? null;
}

export function isCheckoutCvvInputVisible(input: HTMLInputElement): boolean {
  return isElementActionable(input);
}

export function readCheckoutCvvValue(doc: Document = document): string {
  const input = findCheckoutCvvInput(doc);
  return input?.value.trim() ?? "";
}

function isReactValueTrackerSynced(input: HTMLInputElement): boolean {
  const tracker = (
    input as HTMLInputElement & { _valueTracker?: { getValue?: () => string } }
  )._valueTracker;
  if (!tracker?.getValue) {
    return true;
  }
  const tracked = tracker.getValue();
  const current = input.value;
  if (tracked === current) {
    return true;
  }
  // Living Design may lag tracker updates while DOM already shows 3 digits.
  return current.trim().length === 3 && tracked.trim().length === 0;
}

export function blurCheckoutCvvField(doc: Document = document): void {
  const input = findCheckoutCvvInput(doc);
  if (!input) {
    return;
  }

  input.blur();
  input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

  const match = findReactInputHandlers(input);
  if (match?.handlers.onBlur) {
    const event = new Event("blur", { bubbles: true });
    Object.defineProperty(event, "target", { writable: false, value: input });
    Object.defineProperty(event, "currentTarget", { writable: false, value: input });
    match.handlers.onBlur(event as unknown as { target: HTMLInputElement });
  }

  if (doc.activeElement === input) {
    doc.body.focus();
  }
}

export function isCheckoutCvvBlurred(doc: Document = document): boolean {
  const input = findCheckoutCvvInput(doc);
  if (!input) {
    return true;
  }
  return doc.activeElement !== input;
}

function isCheckoutCvvDomReady(
  doc: Document,
  pageUrl?: string,
): boolean {
  if (!isCheckoutCvvSatisfied(doc, pageUrl)) {
    return false;
  }
  if (!isCheckoutCvvBlurred(doc)) {
    return false;
  }
  return true;
}

export function hasCheckoutCvvValidationError(doc: Document = document): boolean {
  if (hasCheckoutFormErrors(doc) && isCheckoutCvvPromptVisible(doc)) {
    return true;
  }
  const input = findCheckoutCvvInput(doc);
  if (!input) {
    return false;
  }
  if (input.getAttribute("aria-invalid") === "true") {
    return true;
  }
  if (input.validity.valid === false && input.value.trim().length > 0) {
    return true;
  }
  for (const alert of doc.querySelectorAll('[role="alert"]')) {
    const text = alert.textContent ?? "";
    if (CVV_VALIDATION_ERROR_TEXT.test(text)) {
      return true;
    }
  }
  return false;
}

export function isCheckoutCvvSatisfied(
  doc: Document = document,
  pageUrl?: string,
): boolean {
  if (isCheckoutPageLoading(doc)) {
    return false;
  }
  if (hasCheckoutFormErrors(doc) && isCheckoutCvvPromptVisible(doc)) {
    return false;
  }
  const input = findCheckoutCvvInput(doc);
  if (!input) {
    // Place order can appear before the CVV section hydrates on review-order.
    if (isReviewOrderCheckout(pageUrl)) {
      return false;
    }
    return !isCheckoutCvvPromptVisible(doc);
  }
  if (!isCheckoutCvvInputVisible(input)) {
    return false;
  }
  if (input.value.trim().length !== 3) {
    return false;
  }
  if (isReviewOrderCheckout(pageUrl) && !isReactValueTrackerSynced(input)) {
    return false;
  }
  return !hasCheckoutCvvValidationError(doc);
}

export function isCheckoutCvvRequired(
  doc: Document = document,
  pageUrl?: string,
): boolean {
  if (hasCheckoutFormErrors(doc) && isCheckoutCvvPromptVisible(doc)) {
    return true;
  }
  if (hasCheckoutCvvValidationError(doc)) {
    return true;
  }
  if (isReviewOrderCheckout(pageUrl) && !isCheckoutCvvSatisfied(doc, pageUrl)) {
    return true;
  }
  if (isCheckoutCvvPromptVisible(doc) && !isCheckoutCvvSatisfied(doc, pageUrl)) {
    return true;
  }
  const input = findCheckoutCvvInput(doc);
  if (!input) {
    return false;
  }
  if (doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR) && !isPlaceOrderEnabled(doc)) {
    return true;
  }
  return !isCheckoutCvvSatisfied(doc, pageUrl);
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
}

type ReactValueTracker = {
  getValue?: () => string;
  setValue: (value: string) => void;
};

function syncReactValueTracker(input: HTMLInputElement, value: string): void {
  const tracker = (input as HTMLInputElement & { _valueTracker?: ReactValueTracker })._valueTracker;
  if (tracker) {
    tracker.setValue(value);
  }
}

function dispatchInputEvent(input: HTMLInputElement, inputType: string, data: string | null): void {
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data,
    }),
  );
}

function canUseExecCommand(): boolean {
  return typeof document.execCommand === "function";
}

function tryFillViaExecCommand(input: HTMLInputElement, value: string): boolean {
  if (!canUseExecCommand()) {
    return false;
  }
  input.focus({ preventScroll: true });
  input.select();
  if (input.value.length > 0) {
    document.execCommand("delete", false);
  }
  syncReactValueTracker(input, "");
  if (!document.execCommand("insertText", false, value)) {
    return false;
  }
  dispatchInputEvent(input, "insertFromPaste", value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return input.value.trim() === value;
}

function tryFillViaPaste(input: HTMLInputElement, value: string): boolean {
  input.focus({ preventScroll: true });
  syncReactValueTracker(input, input.value);
  setNativeInputValue(input, "");
  dispatchInputEvent(input, "deleteContentBackward", null);

  try {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    const accepted = input.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
    if (!accepted) {
      return false;
    }
  } catch {
    return false;
  }

  if (input.value.trim() !== value) {
    setNativeInputValue(input, value);
    syncReactValueTracker(input, value);
    dispatchInputEvent(input, "insertFromPaste", value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return input.value.trim() === value;
}

function tryFillViaReactSetter(input: HTMLInputElement, value: string): boolean {
  input.focus({ preventScroll: true });
  syncReactValueTracker(input, "");
  setNativeInputValue(input, value);
  dispatchInputEvent(input, "insertFromPaste", value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return input.value.trim() === value;
}

/** Simulates human typing so React-controlled CVV fields update internal state. */
async function simulateCvvTyping(
  input: HTMLInputElement,
  value: string,
  charDelayMs = CVV_CHAR_DELAY_MS,
): Promise<void> {
  input.focus({ preventScroll: true });
  input.click();

  if (input.value.trim() === value) {
    return;
  }

  if (tryFillViaReactHandlers(input, value)) {
    await sleep(CVV_POST_TYPE_SETTLE_MS);
    if (input.value.trim() === value) {
      return;
    }
  }

  if (tryFillViaExecCommand(input, value)) {
    await sleep(CVV_POST_TYPE_SETTLE_MS);
    if (input.value.trim() === value) {
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      return;
    }
  }

  if (tryFillViaPaste(input, value)) {
    await sleep(CVV_POST_TYPE_SETTLE_MS);
    if (input.value.trim() === value) {
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      return;
    }
  }

  if (tryFillViaReactSetter(input, value)) {
    await sleep(CVV_POST_TYPE_SETTLE_MS);
    if (input.value.trim() === value) {
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      return;
    }
  }

  syncReactValueTracker(input, "");
  setNativeInputValue(input, "");
  dispatchInputEvent(input, "deleteContentBackward", null);
  await sleep(charDelayMs);

  for (const char of value) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: char, bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertText",
        data: char,
      }),
    );
    syncReactValueTracker(input, input.value);
    setNativeInputValue(input, input.value + char);
    dispatchInputEvent(input, "insertText", char);
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: char, bubbles: true, cancelable: true }),
    );
    await sleep(charDelayMs);
  }

  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  await sleep(CVV_POST_TYPE_SETTLE_MS);

  if (input.value.trim() === value) {
    tryFillViaReactHandlers(input, value);
  }
}

export async function fillCheckoutCvvInput(
  input: HTMLInputElement,
  cvv: string,
  charDelayMs = CVV_CHAR_DELAY_MS,
): Promise<boolean> {
  const normalized = normalizeSamsclubCheckoutCvv(cvv);
  if (!normalized) {
    return false;
  }
  if (!isCheckoutCvvInputVisible(input)) {
    return false;
  }
  await simulateCvvTyping(input, normalized, charDelayMs);
  blurCheckoutCvvField(input.ownerDocument);
  return true;
}

export async function tryFillCheckoutCvv(
  cvv: string | null,
  doc: Document = document,
  pageUrl?: string,
): Promise<FillCheckoutCvvResult> {
  if (isCheckoutPageLoading(doc)) {
    return "missing_field";
  }
  const normalized = cvv == null ? null : normalizeSamsclubCheckoutCvv(cvv);
  if (!normalized) {
    return "invalid_cvv";
  }

  const input = findCheckoutCvvInput(doc);
  if (!input || !isCheckoutCvvInputVisible(input)) {
    return "missing_field";
  }

  if (
    input.value.trim() === normalized &&
    isCheckoutCvvSatisfied(doc, pageUrl)
  ) {
    return "already_set";
  }

  if (input.value.trim() === normalized) {
    return "pending_validation";
  }

  return (await fillCheckoutCvvInput(input, normalized)) ? "filled" : "invalid_cvv";
}

/** Focus/blur CVV so Living Design re-runs validation after a failed Place order. */
export async function nudgeCheckoutCvvValidation(
  doc: Document = document,
): Promise<void> {
  const input = findCheckoutCvvInput(doc);
  if (!input || input.value.trim().length !== 3) {
    return;
  }

  input.focus({ preventScroll: true });
  await sleep(80);
  blurCheckoutCvvField(doc);
  await sleep(CVV_POST_TYPE_SETTLE_MS);
}

function postCvvReadySnapshot(
  doc: Document,
  pageUrl?: string,
): boolean {
  return (
    isCheckoutCvvDomReady(doc, pageUrl) &&
    isPlaceOrderEnabled(doc) &&
    !hasCheckoutFormErrors(doc)
  );
}

export async function waitForPostCvvCheckoutReady(
  doc: Document = document,
  timeoutMs = POST_CVV_READY_TIMEOUT_MS,
  pageUrl?: string,
  stablePollsRequired = POST_CVV_STABLE_POLLS_REQUIRED,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let stablePolls = 0;
  let nudgedBlur = false;

  while (Date.now() < deadline) {
    const cvvValue = readCheckoutCvvValue(doc);
    if (cvvValue.length === 3 && !isCheckoutCvvBlurred(doc)) {
      blurCheckoutCvvField(doc);
      if (!nudgedBlur) {
        nudgedBlur = true;
        await sleep(CVV_POST_TYPE_SETTLE_MS);
        continue;
      }
    }

    if (postCvvReadySnapshot(doc, pageUrl)) {
      stablePolls += 1;
      if (stablePolls >= stablePollsRequired) {
        return true;
      }
    } else {
      stablePolls = 0;
      if (cvvValue.length === 3 && !nudgedBlur) {
        await nudgeCheckoutCvvValidation(doc);
        nudgedBlur = true;
        continue;
      }
    }
    await sleep(POST_CVV_READY_POLL_MS);
  }

  blurCheckoutCvvField(doc);
  return postCvvReadySnapshot(doc, pageUrl) && stablePolls >= stablePollsRequired;
}

export function canSafelyPlaceOrder(
  doc: Document = document,
  pageUrl?: string,
): boolean {
  if (isCheckoutPageLoading(doc)) {
    return false;
  }
  if (isReviewOrderCheckout(pageUrl) && !isCheckoutCvvSatisfied(doc, pageUrl)) {
    return false;
  }
  if (isCheckoutCvvPromptVisible(doc) && !isCheckoutCvvSatisfied(doc, pageUrl)) {
    return false;
  }
  if (hasCheckoutFormErrors(doc)) {
    return false;
  }
  if (!isCheckoutCvvBlurred(doc)) {
    return false;
  }
  return isPlaceOrderEnabled(doc);
}
