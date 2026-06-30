import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";

let revision = 0;

export async function notifyStatusChanged(): Promise<void> {
  revision += 1;
  try {
    await chrome.storage.session.set({ [STORAGE_KEYS.statusRevision]: revision });
  } catch (error) {
    console.warn("CookieScripts: status revision notify failed", error);
  }
}
