import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { hookSpaNavigation } from "@ext/core/lib/spa-navigation.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import { sendToBackground } from "@ext/core/lib/messages.ts";
import {
  WALMART_LAST_READY_COUNT_KEY,
  WALMART_QUEUE_PASS_SEEN_KEY,
} from "@ext/domains/walmart/lib/constants.ts";
import { listenQueueProbe } from "@ext/domains/walmart/lib/queue-probe-bridge.ts";
import {
  detectQueuePassFromBanner,
  detectQueuePassFromNavigation,
  detectQueuePassFromTickets,
  hasPendingTickets,
  isHoldSpotNavigation,
  parseValidateTicketsResponse,
  queuePassDedupKey,
  type QueuePassEvent,
} from "@ext/domains/walmart/lib/queue-pass.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";
import { requestTabConsolidation } from "@ext/domains/walmart/content/tab-consolidation.ts";
import { playQueuePassAlert } from "@ext/domains/walmart/lib/queue-pass-sound.ts";

const BANNER_POLL_MS = 3_000;

let settingsCache: ExtensionSettings | null = null;
let lastHref = location.href;

function readSeenKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(WALMART_QUEUE_PASS_SEEN_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((key): key is string => typeof key === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenKeys(keys: Set<string>): void {
  try {
    sessionStorage.setItem(WALMART_QUEUE_PASS_SEEN_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore
  }
}

function readLastReadyCount(): number {
  try {
    const raw = sessionStorage.getItem(WALMART_LAST_READY_COUNT_KEY);
    if (!raw) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastReadyCount(count: number): void {
  try {
    sessionStorage.setItem(WALMART_LAST_READY_COUNT_KEY, String(count));
  } catch {
    // ignore
  }
}

async function refreshSettings(): Promise<ExtensionSettings> {
  settingsCache = await getSettings();
  return settingsCache;
}

function isSoundEnabled(settings: ExtensionSettings): boolean {
  return settings.enabled && settings.walmart_queue_pass_sound_enabled !== false;
}

async function emitQueuePass(event: QueuePassEvent): Promise<void> {
  const settings = settingsCache ?? (await refreshSettings());
  if (!settings.enabled) {
    return;
  }

  const seen = readSeenKeys();
  const key = queuePassDedupKey(event);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  writeSeenKeys(seen);

  if (isSoundEnabled(settings)) {
    await playQueuePassAlert(1);
  }

  await sendToBackground<BackgroundResponse>({
    type: "WALMART_QUEUE_PASS",
    itemId: event.itemId,
    queueId: event.queueId,
    productName: event.productName,
  });
}

function bannerText(): string {
  const banner = document.querySelector('[data-testid="queue-banner"]');
  if (banner instanceof HTMLElement) {
    return banner.innerText || banner.getAttribute("aria-label") || "";
  }
  return document.body?.innerText ?? "";
}

function hasQueueBanner(): boolean {
  const text = bannerText();
  return /you're in line/i.test(text);
}

function isHomepageWithBanner(): boolean {
  const path = location.pathname.toLowerCase();
  return (path === "/" || path === "") && hasQueueBanner();
}

async function pollBanner(): Promise<void> {
  const settings = settingsCache ?? (await refreshSettings());
  if (!settings.enabled) {
    return;
  }

  const text = bannerText();
  const lastReadyCount = readLastReadyCount();
  const bannerResult = detectQueuePassFromBanner(text, lastReadyCount);
  if (!bannerResult) {
    return;
  }

  writeLastReadyCount(bannerResult.readyCount);
  if (isSoundEnabled(settings)) {
    await playQueuePassAlert(bannerResult.newPasses);
  }

  await sendToBackground<BackgroundResponse>({
    type: "WALMART_QUEUE_PASS",
    itemId: "",
    queueId: "banner",
    productName: `${bannerResult.readyCount} item(s) ready`,
  });
}

function onNavigate(): void {
  const previous = lastHref;
  const current = location.href;
  lastHref = current;

  if (isHoldSpotNavigation(previous, current)) {
    return;
  }

  void (async () => {
    const settings = settingsCache ?? (await refreshSettings());
    if (!settings.enabled) {
      return;
    }
    const seen = readSeenKeys();
    const event = detectQueuePassFromNavigation(previous, current, seen);
    if (event) {
      await emitQueuePass(event);
    }
  })();
}

function onProbeEvent(detail: Record<string, unknown>): void {
  void (async () => {
    const settings = settingsCache ?? (await refreshSettings());
    if (!settings.enabled) {
      return;
    }

    const kind = detail.kind;
    const status = typeof detail.status === "number" ? detail.status : null;
    const snippet =
      typeof detail.responseSnippet === "string" ? detail.responseSnippet : "";

    if (kind === "issueTicket" && status === 200) {
      await requestTabConsolidation("issue_ticket");
      return;
    }

    if (kind !== "validateTickets" || status !== 200) {
      return;
    }

    const tickets = parseValidateTicketsResponse(snippet);
    if (hasPendingTickets(tickets)) {
      await requestTabConsolidation("tickets_pending");
    }

    const seen = readSeenKeys();
    const passes = detectQueuePassFromTickets(tickets, seen);
    for (const pass of passes) {
      await emitQueuePass(pass);
    }
  })();
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const label = (target.innerText || target.getAttribute("aria-label") || "").toLowerCase();
  if (!label.includes("hold my spot")) {
    return;
  }
  void (async () => {
    await requestTabConsolidation("hold_spot");
  })();
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

  const unhookNav = hookSpaNavigation(onNavigate);
  const unlistenProbe = listenQueueProbe(document, onProbeEvent);
  document.addEventListener("click", onClick, true);

  const bannerTimer = setInterval(() => {
    void pollBanner();
    if (isHomepageWithBanner()) {
      void requestTabConsolidation("queue_banner");
    }
  }, BANNER_POLL_MS);

  window.addEventListener("beforeunload", () => {
    clearInterval(bannerTimer);
    unhookNav();
    unlistenProbe();
    document.removeEventListener("click", onClick, true);
  });
}

void bootstrap();
