import { useCallback, useEffect, useState } from "react";

import { checkForUpdate } from "@ext/lib/check-for-update.ts";
import { STORAGE_KEYS } from "@ext/lib/constants.ts";

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const dismissed = await chrome.storage.local.get(STORAGE_KEYS.dismissedReleaseVersion);
      const dismissedVersion =
        (dismissed[STORAGE_KEYS.dismissedReleaseVersion] as string | undefined) ?? null;

      const info = await checkForUpdate();
      if (!info) {
        setUpdateAvailable(false);
        setLatestVersion(null);
        setReleaseUrl(null);
        return;
      }

      if (dismissedVersion === info.latestVersion) {
        setUpdateAvailable(false);
        setLatestVersion(info.latestVersion);
        setReleaseUrl(info.releaseUrl);
        return;
      }

      setUpdateAvailable(true);
      setLatestVersion(info.latestVersion);
      setReleaseUrl(info.releaseUrl);
    } catch {
      setUpdateAvailable(false);
      setLatestVersion(null);
      setReleaseUrl(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(async () => {
    if (!latestVersion) {
      return;
    }
    setDismissing(true);
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.dismissedReleaseVersion]: latestVersion,
      });
      setUpdateAvailable(false);
    } finally {
      setDismissing(false);
    }
  }, [latestVersion]);

  return { updateAvailable, latestVersion, releaseUrl, dismissing, dismiss };
}
