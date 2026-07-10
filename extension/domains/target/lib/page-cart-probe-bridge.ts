import { isExtensionContextValid } from "@ext/core/lib/messages.ts";

export const CART_PROBE_REQUEST_EVENT = "cookiescripts:cart-probe-request";
export const CART_PROBE_RESPONSE_EVENT = "cookiescripts:cart-probe-response";

const BRIDGE_SCRIPT_ID = "cookiescripts-cart-probe-bridge";
const BRIDGE_LOADING = "loading";
const BRIDGE_READY = "ready";
const BRIDGE_FAILED = "failed";
const DEFAULT_PROBE_TIMEOUT_MS = 3_000;
const CART_PROBE_SCRIPT_PATH = "injected/cart-probe.js";

export type PageProbeSuccess = {
  status: number;
  body: unknown;
};

export type PageProbeFailure = {
  error: true;
};

export type PageProbeResponse = PageProbeSuccess | PageProbeFailure;

const loadPromises = new WeakMap<HTMLScriptElement, Promise<"ready" | "failed">>();

export function isPageProbeFailure(
  response: PageProbeResponse,
): response is PageProbeFailure {
  return "error" in response && response.error === true;
}

function defaultGetScriptUrl(): string {
  if (!isExtensionContextValid()) {
    throw new Error("Extension context invalidated.");
  }
  return chrome.runtime.getURL(CART_PROBE_SCRIPT_PATH);
}

function waitForBridgeAttribute(
  script: HTMLScriptElement,
  expected: string,
  timeoutMs = 5_000,
): Promise<boolean> {
  if (script.getAttribute("data-cs-bridge") === expected) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const observer = new MutationObserver(() => {
      if (script.getAttribute("data-cs-bridge") === expected) {
        observer.disconnect();
        resolve(true);
      } else if (Date.now() >= deadline) {
        observer.disconnect();
        resolve(false);
      }
    });
    observer.observe(script, { attributes: true, attributeFilter: ["data-cs-bridge"] });

    const timer = setInterval(() => {
      if (script.getAttribute("data-cs-bridge") === expected) {
        clearInterval(timer);
        observer.disconnect();
        resolve(true);
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        observer.disconnect();
        resolve(false);
      }
    }, 50);
  });
}

function injectBridgeScript(
  doc: Document,
  getScriptUrl: () => string,
): Promise<"ready" | "failed"> {
  let scriptSrc: string;
  try {
    scriptSrc = getScriptUrl();
  } catch {
    return Promise.resolve("failed");
  }

  const script = doc.createElement("script");
  script.id = BRIDGE_SCRIPT_ID;
  script.src = scriptSrc;
  script.setAttribute("data-cs-bridge", BRIDGE_LOADING);

  const promise = new Promise<"ready" | "failed">((resolve) => {
    script.onload = () => {
      void waitForBridgeAttribute(script, BRIDGE_READY).then((ready) => {
        if (!ready) {
          script.setAttribute("data-cs-bridge", BRIDGE_FAILED);
          script.remove();
          loadPromises.delete(script);
          resolve("failed");
          return;
        }
        script.setAttribute("data-cs-bridge", BRIDGE_READY);
        resolve("ready");
      });
    };
    script.onerror = () => {
      script.setAttribute("data-cs-bridge", BRIDGE_FAILED);
      script.remove();
      loadPromises.delete(script);
      resolve("failed");
    };
  });

  loadPromises.set(script, promise);
  doc.documentElement.appendChild(script);
  return promise;
}

export async function ensurePageCartProbeBridge(
  doc: Document,
  getScriptUrl: () => string = defaultGetScriptUrl,
): Promise<"ready" | "failed"> {
  const existing = doc.getElementById(BRIDGE_SCRIPT_ID);
  if (existing instanceof HTMLScriptElement) {
    const state = existing.getAttribute("data-cs-bridge");
    if (state === BRIDGE_READY) {
      return "ready";
    }
    if (state === BRIDGE_LOADING) {
      const pending = loadPromises.get(existing);
      if (pending) {
        return pending;
      }
      const ready = await waitForBridgeAttribute(existing, BRIDGE_READY);
      return ready ? "ready" : "failed";
    }
    existing.remove();
  }

  return injectBridgeScript(doc, getScriptUrl);
}

export type ProbeInPageContextOptions = {
  doc?: Document;
  timeoutMs?: number;
};

export function probeInPageContext(
  url: string,
  bodyJson: string,
  options: ProbeInPageContextOptions = {},
): Promise<PageProbeResponse> {
  const doc = options.doc ?? document;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const probeId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onResponse = (event: Event): void => {
      const detail = (event as CustomEvent<{
        probeId?: string;
        status?: number;
        body?: unknown;
        error?: boolean;
      }>).detail;
      if (!detail || detail.probeId !== probeId) {
        return;
      }

      cleanup();
      if (detail.error) {
        resolve({ error: true });
        return;
      }

      resolve({
        status: detail.status ?? 0,
        body: detail.body ?? null,
      });
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("cart probe timeout"));
    }, timeoutMs);

    function cleanup(): void {
      clearTimeout(timer);
      doc.removeEventListener(CART_PROBE_RESPONSE_EVENT, onResponse);
    }

    doc.addEventListener(CART_PROBE_RESPONSE_EVENT, onResponse);
    doc.dispatchEvent(
      new CustomEvent(CART_PROBE_REQUEST_EVENT, {
        detail: { probeId, url, body: bodyJson },
      }),
    );
  });
}
