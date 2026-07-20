import { buildSamsclubClickDescriptor } from "@ext/domains/samsclub/content/recorder/click-descriptor.ts";
import type { SamsclubRecordingEvent } from "@ext/domains/samsclub/types/samsclub.ts";

export function attachClickCapture(onEvent: (event: SamsclubRecordingEvent) => void): () => void {
  const handler = (mouseEvent: MouseEvent) => {
    const target = mouseEvent.target;
    if (!(target instanceof Element)) {
      return;
    }
    const descriptor = buildSamsclubClickDescriptor(target);
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
