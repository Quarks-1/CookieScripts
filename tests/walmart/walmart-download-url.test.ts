import { describe, expect, it } from "vitest";

import { uint8ArrayToBase64, zipBytesToDownloadUrl } from "@ext/domains/walmart/lib/download-url.ts";

describe("walmart download-url", () => {
  it("round-trips bytes through base64 data URL when createObjectURL is missing", () => {
    const original = URL.createObjectURL;
    // @ts-expect-error simulate MV3 service worker
    URL.createObjectURL = undefined;

    try {
      const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const url = zipBytesToDownloadUrl(bytes);
      expect(url.startsWith("data:application/zip;base64,")).toBe(true);
      const encoded = url.slice("data:application/zip;base64,".length);
      expect(atob(encoded)).toBe(String.fromCharCode(0x50, 0x4b, 0x03, 0x04));
    } finally {
      URL.createObjectURL = original;
    }
  });

  it("encodes uint8 arrays to base64", () => {
    expect(uint8ArrayToBase64(new Uint8Array([1, 2, 3]))).toBe(btoa("\x01\x02\x03"));
  });
});
