import { buildExportZip } from "@ext/domains/samsclub/lib/export-bundle.ts";
import { revokeDownloadUrl, zipBytesToDownloadUrl } from "@ext/domains/samsclub/lib/download-url.ts";
import type { SamsclubLastExport } from "@ext/domains/samsclub/types/samsclub.ts";

export async function downloadSessionZip(sessionId: string): Promise<SamsclubLastExport> {
  const { zipBytes, downloadFilename, meta } = await buildExportZip(sessionId);
  const downloadUrl = zipBytesToDownloadUrl(zipBytes);

  const downloadId = await new Promise<number>((resolve, reject) => {
    chrome.downloads.download(
      {
        url: downloadUrl,
        filename: downloadFilename,
        saveAs: false,
      },
      (id) => {
        revokeDownloadUrl(downloadUrl);
        if (chrome.runtime.lastError || id === undefined) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Download failed"));
          return;
        }
        resolve(id);
      },
    );
  });

  const filename = await waitForDownloadComplete(downloadId);
  return {
    downloadId,
    filename,
    exportedAt: new Date().toISOString(),
    sessionId: meta.sessionId,
  };
}

function waitForDownloadComplete(downloadId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(new Error("Download timed out"));
    }, 120_000);

    function listener(delta: chrome.downloads.DownloadDelta): void {
      if (delta.id !== downloadId) {
        return;
      }
      if (delta.state?.current === "complete") {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        void chrome.downloads.search({ id: downloadId }).then((items) => {
          const item = items[0];
          if (!item?.filename) {
            reject(new Error("Download path unavailable"));
            return;
          }
          resolve(item.filename);
        });
      }
      if (delta.error?.current) {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error(delta.error.current));
      }
    }

    chrome.downloads.onChanged.addListener(listener);
    void chrome.downloads.search({ id: downloadId }).then((items) => {
      if (items[0]?.state === "complete" && items[0].filename) {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        resolve(items[0].filename);
      }
    });
  });
}
