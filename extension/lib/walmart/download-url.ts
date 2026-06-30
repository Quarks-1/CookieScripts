/** MV3 service workers may lack URL.createObjectURL; chrome.downloads accepts data URLs. */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function zipBytesToDownloadUrl(bytes: Uint8Array): string {
  if (typeof URL.createObjectURL === "function") {
    try {
      const blob = new Blob([bytes], { type: "application/zip" });
      return URL.createObjectURL(blob);
    } catch {
      // Fall back to data URL below.
    }
  }
  return `data:application/zip;base64,${uint8ArrayToBase64(bytes)}`;
}

export function revokeDownloadUrl(url: string): void {
  if (url.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}
