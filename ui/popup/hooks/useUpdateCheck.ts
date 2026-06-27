import { useCallback, useEffect, useState } from "react";

import { checkForUpdate } from "@ext/lib/check-for-update.ts";
import { getInstalledVersion } from "@ext/lib/version.ts";

export function useUpdateCheck() {
  const [installedVersion] = useState(() => getInstalledVersion());
  const [checking, setChecking] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const info = await checkForUpdate();
      if (!info) {
        setUpdateAvailable(false);
        setReleaseUrl(null);
        return;
      }
      setUpdateAvailable(true);
      setReleaseUrl(info.releaseUrl);
    } catch {
      setUpdateAvailable(false);
      setReleaseUrl(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { installedVersion, checking, updateAvailable, releaseUrl, refresh };
}
