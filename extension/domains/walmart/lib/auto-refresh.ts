export const WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC = 10;
export const WALMART_AUTO_REFRESH_MIN_INTERVAL_SEC = 1;
export const WALMART_AUTO_REFRESH_MAX_INTERVAL_SEC = 3600;

export function normalizeWalmartRefreshIntervalSec(raw: unknown): number {
  if (raw === "" || raw == null) {
    return WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC;
  }
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) {
    return WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC;
  }
  return Math.max(
    WALMART_AUTO_REFRESH_MIN_INTERVAL_SEC,
    Math.min(WALMART_AUTO_REFRESH_MAX_INTERVAL_SEC, Math.floor(parsed)),
  );
}

export function shouldWalmartHardRefresh(
  now: number,
  lastRefreshAt: number | undefined,
  intervalSec: number,
  enabled: boolean,
  pause: boolean,
): boolean {
  if (!enabled || intervalSec < WALMART_AUTO_REFRESH_MIN_INTERVAL_SEC || pause) {
    return false;
  }
  const elapsed = now - (lastRefreshAt ?? 0);
  return elapsed >= intervalSec * 1000;
}
