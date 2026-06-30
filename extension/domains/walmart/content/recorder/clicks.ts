import { buildWalmartClickDescriptor } from "@ext/domains/walmart/content/recorder/click-descriptor.ts";
import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export function attachClickCapture(onEvent: (event: WalmartRecordingEvent) => void): () => void {
  const handler = (mouseEvent: MouseEvent) => {
    const target = mouseEvent.target;
    if (!(target instanceof Element)) {
      return;
    }
    const descriptor = buildWalmartClickDescriptor(target);
    onEvent({
      kind: "click",
      ts: new Date().toISOString(),
      url: location.href,
      descriptor,
    });
  };
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
