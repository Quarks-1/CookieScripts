import {
  QUEUE_PROBE_BRIDGE_ID,
  QUEUE_PROBE_EVENT,
  QUEUE_PROBE_SCRIPT_PATH,
} from "@ext/domains/walmart/lib/constants.ts";

const BRIDGE_LOADING = "loading";
const BRIDGE_READY = "ready";
const BRIDGE_FAILED = "failed";

const loadPromises = new WeakMap<HTMLScriptElement, Promise<"ready" | "failed">>();

function defaultGetScriptUrl(): string {
  return chrome.runtime.getURL(QUEUE_PROBE_SCRIPT_PATH);
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
  const script = doc.createElement("script");
  script.id = QUEUE_PROBE_BRIDGE_ID;
  script.src = getScriptUrl();
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

export async function ensureQueueProbe(
  doc: Document,
  getScriptUrl: () => string = defaultGetScriptUrl,
): Promise<"ready" | "failed"> {
  const existing = doc.getElementById(QUEUE_PROBE_BRIDGE_ID);
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

export function listenQueueProbe(
  doc: Document,
  onEvent: (detail: Record<string, unknown>) => void,
): () => void {
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    if (detail) {
      onEvent(detail);
    }
  };
  doc.addEventListener(QUEUE_PROBE_EVENT, handler);
  return () => doc.removeEventListener(QUEUE_PROBE_EVENT, handler);
}

export { QUEUE_PROBE_EVENT };
