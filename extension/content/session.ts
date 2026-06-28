import {
  extractAuthor,
  extractLinksFromMessage,
  getMessageId,
  isOwnMessage,
} from "@ext/content/extract.ts";
import {
  installDetectedDomainsListener,
  startDetectedDomainScan,
  stopDetectedDomainScan,
} from "@ext/content/detected-domains.ts";
import { hookSpaNavigation } from "@ext/content/navigation.ts";
import { attachMessagePipeline } from "@ext/content/observers.ts";
import { MESSAGE_ARTICLE } from "@ext/content/selectors.ts";
import { parseChannelId } from "@ext/lib/channels.ts";
import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import {
  isChannelActive,
  isExtensionContextInvalidatedError,
  isExtensionContextValid,
  requestWatchConfig,
  sendCandidateLinks,
  sendChannelInactive,
} from "@ext/lib/messages.ts";
import { sleep } from "@ext/lib/sleep.ts";

const SEEN_MESSAGE_ID_LIMIT = 2000;
const WATCH_CONFIG_MAX_ATTEMPTS = 3;
const WATCH_CONFIG_RETRY_BASE_MS = 100;
const MESSAGE_BOOTSTRAP_QUIET_MS = 500;

type Session = {
  channelId: string | null;
  watched: boolean;
  disconnectObservers: (() => void) | null;
  syncGeneration: number;
  seenMessageIds: Set<string>;
};

const session: Session = {
  channelId: null,
  watched: false,
  disconnectObservers: null,
  syncGeneration: 0,
  seenMessageIds: new Set(),
};

let syncChain: Promise<void> = Promise.resolve();
let sessionEnded = false;
let unhookNavigation: (() => void) | null = null;
let bootstrapQuietTimer: ReturnType<typeof setTimeout> | null = null;
let messageBootstrapActive = false;

function endSession(): void {
  if (sessionEnded) {
    return;
  }
  sessionEnded = true;
  stopObserving();
  session.channelId = null;
  session.watched = false;
  session.seenMessageIds.clear();
  unhookNavigation?.();
  unhookNavigation = null;
}

function clearMessageBootstrap(): void {
  messageBootstrapActive = false;
  if (bootstrapQuietTimer !== null) {
    clearTimeout(bootstrapQuietTimer);
    bootstrapQuietTimer = null;
  }
}

function extendMessageBootstrap(): void {
  messageBootstrapActive = true;
  if (bootstrapQuietTimer !== null) {
    clearTimeout(bootstrapQuietTimer);
  }
  bootstrapQuietTimer = setTimeout(() => {
    bootstrapQuietTimer = null;
    messageBootstrapActive = false;
  }, MESSAGE_BOOTSTRAP_QUIET_MS);
}

function seedExistingMessageIds(root: Element): void {
  for (const article of root.querySelectorAll(MESSAGE_ARTICLE)) {
    const messageId = getMessageId(article);
    if (messageId !== null) {
      rememberMessageId(messageId);
    }
  }
}

function stopObserving(): void {
  clearMessageBootstrap();
  stopDetectedDomainScan();
  session.disconnectObservers?.();
  session.disconnectObservers = null;
}

function rememberMessageId(messageId: string): void {
  if (session.seenMessageIds.has(messageId)) {
    return;
  }
  session.seenMessageIds.add(messageId);
  while (session.seenMessageIds.size > SEEN_MESSAGE_ID_LIMIT) {
    const oldest = session.seenMessageIds.values().next().value;
    if (oldest === undefined) {
      break;
    }
    session.seenMessageIds.delete(oldest);
  }
}

function onMessageAdded(node: Element): void {
  if (!isExtensionContextValid()) {
    stopObserving();
    session.watched = false;
    return;
  }

  const channelId = session.channelId;
  if (!channelId || !session.watched) {
    return;
  }

  const messageId = getMessageId(node);
  if (messageId !== null) {
    if (session.seenMessageIds.has(messageId)) {
      return;
    }
    rememberMessageId(messageId);
  }

  if (messageBootstrapActive) {
    extendMessageBootstrap();
    return;
  }

  if (isOwnMessage(node)) {
    return;
  }

  const urls = extractLinksFromMessage(node);
  if (urls.length === 0) {
    return;
  }

  void sendCandidateLinks({
    type: "CANDIDATE_LINKS",
    channel_id: channelId,
    urls,
    author: extractAuthor(node),
  });
}

async function requestWatchConfigWithRetry(
  channelId: string,
  gen: number,
): Promise<Awaited<ReturnType<typeof requestWatchConfig>>> {
  for (let attempt = 0; attempt < WATCH_CONFIG_MAX_ATTEMPTS; attempt++) {
    if (session.syncGeneration !== gen || sessionEnded) {
      return null;
    }
    if (!isExtensionContextValid()) {
      endSession();
      return null;
    }
    const config = await requestWatchConfig(channelId);
    if (config !== null) {
      return config;
    }
    if (!isExtensionContextValid()) {
      endSession();
      return null;
    }
    if (attempt < WATCH_CONFIG_MAX_ATTEMPTS - 1) {
      await sleep(WATCH_CONFIG_RETRY_BASE_MS * (attempt + 1));
    }
  }
  return null;
}

async function runSyncChannel(): Promise<void> {
  if (sessionEnded) {
    return;
  }

  const gen = ++session.syncGeneration;
  const previousChannelId = session.channelId;
  const wasWatched = session.watched;

  stopObserving();
  session.channelId = null;
  session.watched = false;

  if (!isExtensionContextValid()) {
    endSession();
    return;
  }

  const channelId = parseChannelId(location.pathname);
  if (channelId === null) {
    if (wasWatched || previousChannelId !== null) {
      await sendChannelInactive();
    }
    session.seenMessageIds.clear();
    return;
  }

  const config = await requestWatchConfigWithRetry(channelId, gen);
  if (session.syncGeneration !== gen) {
    return;
  }

  if (config === null) {
    if (wasWatched || previousChannelId !== null) {
      await sendChannelInactive();
    }
    return;
  }

  const watched = isChannelActive(config);
  session.channelId = channelId;

  if (channelId !== previousChannelId) {
    session.seenMessageIds.clear();
  }

  if (!watched) {
    if (wasWatched || previousChannelId !== null) {
      await sendChannelInactive();
    }
    return;
  }

  session.watched = true;
  session.disconnectObservers = attachMessagePipeline(onMessageAdded, (messageListRoot) => {
    seedExistingMessageIds(messageListRoot);
    extendMessageBootstrap();
    startDetectedDomainScan(channelId, messageListRoot);
  });
}

function syncChannel(): void {
  if (sessionEnded) {
    return;
  }
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  syncChain = syncChain.then(runSyncChannel).catch((error) => {
    if (isExtensionContextInvalidatedError(error) || !isExtensionContextValid()) {
      endSession();
      return;
    }
    console.error("CookieScripts: syncChannel failed", error);
  });
}

export function startSession(): void {
  installDetectedDomainsListener();

  unhookNavigation = hookSpaNavigation(() => {
    if (sessionEnded || !isExtensionContextValid()) {
      endSession();
      return;
    }
    syncChannel();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (sessionEnded || !isExtensionContextValid()) {
      endSession();
      return;
    }
    if (area === "local" && changes[STORAGE_KEYS.settings]) {
      syncChannel();
    }
  });

  syncChannel();
}
