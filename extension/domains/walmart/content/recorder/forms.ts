import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export function attachFormCapture(onEvent: (event: WalmartRecordingEvent) => void): () => void {
  const onSubmit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    onEvent({
      kind: "form_submit",
      ts: new Date().toISOString(),
      url: location.href,
      action: form.action || location.href,
      method: (form.method || "GET").toUpperCase(),
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const form = target.closest("form");
    if (!form) {
      return;
    }
    onEvent({
      kind: "form_submit",
      ts: new Date().toISOString(),
      url: location.href,
      action: form.action || location.href,
      method: `${(form.method || "GET").toUpperCase()} (Enter)`,
    });
  };

  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("submit", onSubmit, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}
