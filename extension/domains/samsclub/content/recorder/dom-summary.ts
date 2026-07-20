import type { DomButtonSummary } from "@ext/domains/samsclub/types/samsclub.ts";
import { scanDomSignals } from "@ext/domains/samsclub/content/recorder/dom-signals.ts";

export function scanDomSummary(root: ParentNode = document): {
  buttons: DomButtonSummary[];
  landmarks: string[];
  signals: string[];
} {
  const buttons: DomButtonSummary[] = [];
  const nodes = root.querySelectorAll(
    "button, a[role='button'], [role='button'], input[type='button'], input[type='submit']",
  );
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) {
      continue;
    }
    buttons.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      dataAutomationId: el.getAttribute("data-automation-id"),
      dataTestId: el.getAttribute("data-testid"),
      ariaLabel: el.getAttribute("aria-label"),
      disabled: el instanceof HTMLButtonElement ? el.disabled : null,
      text: (el.textContent ?? "").trim().slice(0, 120),
    });
    if (buttons.length >= 40) {
      break;
    }
  }

  const landmarks: string[] = [];
  const bodyText = (document.body?.innerText ?? "").toLowerCase();
  for (const phrase of [
    "queue",
    "waiting",
    "almost gone",
    "hang tight",
    "hold tight",
    "high traffic",
    "in line",
    "ready to buy",
    "add to cart",
    "out of stock",
    "checkout",
    "sold out",
  ]) {
    if (bodyText.includes(phrase)) {
      landmarks.push(phrase);
    }
  }

  return { buttons, landmarks, signals: scanDomSignals(root) };
}

export function readStorageKeyNames(): { local: string[]; session: string[] } {
  const local: string[] = [];
  const session: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) {
        local.push(key);
      }
    }
  } catch {
    // ignore
  }
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key !== "cookiescripts:samsclubRecordingSessionId") {
        session.push(key);
      }
    }
  } catch {
    // ignore
  }
  return { local, session };
}
