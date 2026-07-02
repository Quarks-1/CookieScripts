import { WALMART_AUTO_REFRESH_STORAGE_KEY, WALMART_THROTTLE_ACTIVE_KEY } from "@ext/domains/walmart/lib/constants.ts";
import {
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  shouldWalmartHardRefresh,
} from "@ext/domains/walmart/lib/auto-refresh.ts";
import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, BackgroundToContent } from "@ext/core/types/index.ts";

type StoredAutoRefresh = {
  enabled: boolean;
  interval_sec: number;
  last_refresh_at?: number;
};

type ActiveConfig = {
  enabled: boolean;
  interval_sec: number;
  pause: boolean;
  last_refresh_at?: number;
};

let tickTimer: ReturnType<typeof setInterval> | null = null;
let activeConfig: ActiveConfig = {
  enabled: false,
  interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  pause: false,
};

function readSessionStorage(): StoredAutoRefresh | null {
  try {
    const raw = sessionStorage.getItem(WALMART_AUTO_REFRESH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredAutoRefresh;
    if (typeof parsed.enabled !== "boolean" || typeof parsed.interval_sec !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionStorage(config: ActiveConfig): void {
  try {
    const stored: StoredAutoRefresh = {
      enabled: config.enabled,
      interval_sec: config.interval_sec,
      last_refresh_at: config.last_refresh_at,
    };
    sessionStorage.setItem(WALMART_AUTO_REFRESH_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

function applyConfig(config: ActiveConfig, resetCountdown: boolean): void {
  const next: ActiveConfig = {
    ...config,
    last_refresh_at: resetCountdown ? Date.now() : config.last_refresh_at,
  };
  activeConfig = next;
  writeSessionStorage(next);
}

function stopTick(): void {
  if (tickTimer != null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function startTick(): void {
  stopTick();
  tickTimer = setInterval(() => {
    void runTick();
  }, 1000);
}

async function runTick(): Promise<void> {
  if (sessionStorage.getItem(WALMART_THROTTLE_ACTIVE_KEY) === "1") {
    return;
  }
  if (
    !shouldWalmartHardRefresh(
      Date.now(),
      activeConfig.last_refresh_at,
      activeConfig.interval_sec,
      activeConfig.enabled,
      activeConfig.pause,
    )
  ) {
    return;
  }

  const lastRefreshAt = Date.now();
  activeConfig = { ...activeConfig, last_refresh_at: lastRefreshAt };
  writeSessionStorage(activeConfig);

  await sendToBackground<BackgroundResponse>({ type: "WALMART_HARD_RELOAD" });
}

function handleConfigMessage(message: Extract<BackgroundToContent, { type: "WALMART_AUTO_REFRESH_CONFIG" }>): void {
  const previous = activeConfig;
  const enabledChanged = previous.enabled !== message.enabled;
  const intervalChanged = previous.interval_sec !== message.interval_sec;
  applyConfig(
    {
      enabled: message.enabled,
      interval_sec: message.interval_sec,
      pause: message.pause,
      last_refresh_at: previous.last_refresh_at,
    },
    enabledChanged || intervalChanged,
  );
  startTick();
}

async function bootstrap(): Promise<void> {
  const remote = await sendToBackground<BackgroundResponse>({
    type: "WALMART_GET_AUTO_REFRESH_CONFIG",
  });
  const local = readSessionStorage();

  if ("ok" in remote && remote.ok === true && "enabled" in remote && remote.enabled) {
    applyConfig(
      {
        enabled: remote.enabled,
        interval_sec: remote.interval_sec,
        pause: remote.pause,
        last_refresh_at: local?.last_refresh_at,
      },
      false,
    );
  } else if (local?.enabled) {
    await sendToBackground<BackgroundResponse>({
      type: "WALMART_SYNC_AUTO_REFRESH",
      enabled: local.enabled,
      interval_sec: local.interval_sec,
      last_refresh_at: local.last_refresh_at,
    });
    applyConfig(
      {
        enabled: local.enabled,
        interval_sec: local.interval_sec,
        pause: false,
        last_refresh_at: local.last_refresh_at,
      },
      false,
    );
  } else if ("ok" in remote && remote.ok === true && "enabled" in remote) {
    applyConfig(
      {
        enabled: remote.enabled,
        interval_sec: remote.interval_sec,
        pause: remote.pause,
        last_refresh_at: local?.last_refresh_at,
      },
      false,
    );
  } else {
    applyConfig(
      {
        enabled: false,
        interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
        pause: false,
      },
      false,
    );
  }

  startTick();
}

chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
  if (message.type === "WALMART_AUTO_REFRESH_CONFIG") {
    handleConfigMessage(message);
  }
});

void bootstrap();
