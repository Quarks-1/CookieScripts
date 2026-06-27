import { GITHUB_RELEASES_LATEST_URL, STORAGE_KEYS } from "@ext/lib/constants.ts";
import { getInstalledVersion, isNewerVersion, parseReleaseVersion } from "@ext/lib/version.ts";

export interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

interface UpdateCheckCache {
  checkedAt: number;
  latestVersion: string | null;
  releaseUrl: string | null;
  etag: string | null;
}

async function readCache(): Promise<UpdateCheckCache | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.updateCheck);
  return (result[STORAGE_KEYS.updateCheck] as UpdateCheckCache | undefined) ?? null;
}

async function writeCache(cache: UpdateCheckCache): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.updateCheck]: cache });
}

async function fetchLatestRelease(etag: string | null): Promise<{
  release: GitHubRelease | null;
  etag: string | null;
  notModified: boolean;
}> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(GITHUB_RELEASES_LATEST_URL, { headers });
  if (response.status === 304) {
    return { release: null, etag, notModified: true };
  }
  if (!response.ok) {
    return { release: null, etag: null, notModified: false };
  }

  const release = (await response.json()) as GitHubRelease;
  return {
    release,
    etag: response.headers.get("etag"),
    notModified: false,
  };
}

function toUpdateInfo(release: GitHubRelease): UpdateInfo | null {
  if (release.draft || release.prerelease) {
    return null;
  }
  const latestVersion = parseReleaseVersion(release.tag_name);
  if (!latestVersion) {
    return null;
  }
  return { latestVersion, releaseUrl: release.html_url };
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = getInstalledVersion();
  const cache = await readCache();

  let latestVersion = cache?.latestVersion ?? null;
  let releaseUrl = cache?.releaseUrl ?? null;

  try {
    const { release, etag, notModified } = await fetchLatestRelease(cache?.etag ?? null);
    if (notModified && cache) {
      latestVersion = cache.latestVersion;
      releaseUrl = cache.releaseUrl;
      await writeCache({
        checkedAt: Date.now(),
        latestVersion,
        releaseUrl,
        etag: etag ?? cache.etag,
      });
    } else if (release) {
      const info = toUpdateInfo(release);
      latestVersion = info?.latestVersion ?? null;
      releaseUrl = info?.releaseUrl ?? null;
      await writeCache({
        checkedAt: Date.now(),
        latestVersion,
        releaseUrl,
        etag: etag ?? cache?.etag ?? null,
      });
    }
  } catch {
    // Keep cached values on network errors.
  }

  if (!latestVersion || !releaseUrl) {
    return null;
  }
  if (!isNewerVersion(latestVersion, current)) {
    return null;
  }
  return { latestVersion, releaseUrl };
}
