import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export function attachNavigationCapture(onNavigate: (from: string, to: string) => void): () => void {
  let lastUrl = location.href;

  const check = () => {
    const next = location.href;
    if (next !== lastUrl) {
      const from = lastUrl;
      lastUrl = next;
      onNavigate(from, next);
    }
  };

  const interval = window.setInterval(check, 500);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    check();
  };
  history.replaceState = (...args) => {
    originalReplaceState(...args);
    check();
  };

  window.addEventListener("popstate", check);

  return () => {
    clearInterval(interval);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", check);
  };
}

export function navigationEvent(from: string, to: string): WalmartRecordingEvent {
  return { kind: "navigation", ts: new Date().toISOString(), from, to };
}
