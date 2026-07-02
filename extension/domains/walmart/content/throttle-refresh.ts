import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import { sendToBackground } from "@ext/core/lib/messages.ts";
import {
  WALMART_THROTTLE_ACTIVE_KEY,
  WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
  WALMART_THROTTLE_REFRESH_STORAGE_KEY,
} from "@ext/domains/walmart/lib/constants.ts";
import {
  normalizeWalmartRefreshIntervalSec,
  shouldWalmartHardRefresh,
} from "@ext/domains/walmart/lib/auto-refresh.ts";
import { isThrottlePage } from "@ext/domains/walmart/lib/throttle-page.ts";
import type { BackgroundResponse, ExtensionSettings } from "@ext/core/types/index.ts";

const THROTTLE_POLL_MS = 2_000;

type ThrottleRefreshState = {
  last_refresh_at?: number;
};

let settingsCache: ExtensionSettings | null = null;
let loadingSince: number | null = null;

function readThrottleState(): ThrottleRefreshState {
  try {
    const raw = sessionStorage.getItem(WALMART_THROTTLE_REFRESH_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as ThrottleRefreshState;
  } catch {
    return {};
  }
}

function writeThrottleState(state: ThrottleRefreshState): void {
  try {
    sessionStorage.setItem(WALMART_THROTTLE_REFRESH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function throttleIntervalSec(settings: ExtensionSettings): number {
  return normalizeWalmartRefreshIntervalSec(
    settings.walmart_throttle_refresh_interval_sec ?? WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
  );
}

function mainContentText(): string {
  const el = document.querySelector('[data-testid="main-content-container"]');
  return el?.textContent ?? "";
}

async function refreshSettings(): Promise<ExtensionSettings> {
  settingsCache = await getSettings();
  return settingsCache;
}

async function runTick(): Promise<void> {
  const settings = settingsCache ?? (await refreshSettings());
  if (!settings.enabled) {
    sessionStorage.removeItem(WALMART_THROTTLE_ACTIVE_KEY);
    return;
  }

  const bodyText = document.body?.innerText ?? "";
  const pathname = location.pathname;
  const mainText = mainContentText();

  if (mainText.includes("Loading")) {
    loadingSince ??= Date.now();
  } else {
    loadingSince = null;
  }

  const loadingSinceMs =
    loadingSince != null ? Date.now() - loadingSince : undefined;

  const active = isThrottlePage({
    bodyText,
    pathname,
    loadingSinceMs,
    mainContentText: mainText,
  });

  if (!active) {
    sessionStorage.removeItem(WALMART_THROTTLE_ACTIVE_KEY);
    return;
  }

  sessionStorage.setItem(WALMART_THROTTLE_ACTIVE_KEY, "1");

  const state = readThrottleState();
  const intervalSec = throttleIntervalSec(settings);
  const now = Date.now();
  if (
    !shouldWalmartHardRefresh(
      now,
      state.last_refresh_at,
      intervalSec,
      true,
      false,
    )
  ) {
    return;
  }

  writeThrottleState({ last_refresh_at: now });
  await sendToBackground<BackgroundResponse>({ type: "WALMART_HARD_RELOAD" });
}

async function bootstrap(): Promise<void> {
  await refreshSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEYS.settings]) {
      return;
    }
    const next = changes[STORAGE_KEYS.settings].newValue;
    if (next && typeof next === "object") {
      settingsCache = next as ExtensionSettings;
    }
  });

  setInterval(() => {
    void runTick();
  }, THROTTLE_POLL_MS);
}

void bootstrap();
