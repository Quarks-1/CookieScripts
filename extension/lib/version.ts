const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function getInstalledVersion(): string {
  return chrome.runtime.getManifest().version;
}

export function parseReleaseVersion(tag: string): string | null {
  const match = tag.trim().match(VERSION_PATTERN);
  if (!match) {
    return null;
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function compareVersions(a: string, b: string): number {
  const partsA = parseReleaseVersion(a) ?? a;
  const partsB = parseReleaseVersion(b) ?? b;
  const segA = partsA.split(".").map((n) => Number.parseInt(n, 10));
  const segB = partsB.split(".").map((n) => Number.parseInt(n, 10));
  if (segA.length !== 3 || segB.length !== 3 || segA.some(Number.isNaN) || segB.some(Number.isNaN)) {
    return 0;
  }
  for (let i = 0; i < 3; i += 1) {
    if (segA[i] > segB[i]) {
      return 1;
    }
    if (segA[i] < segB[i]) {
      return -1;
    }
  }
  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}
