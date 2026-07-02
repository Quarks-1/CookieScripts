import { isQpUrl } from "@ext/domains/walmart/lib/tab-consolidation.ts";

export type QueueTicket = {
  queue: string;
  itemId: string;
  state: string;
  productName?: string;
};

export type QueuePassEvent = {
  queueId: string;
  itemId: string;
  productName?: string;
  source: "network" | "banner" | "nav";
};

export function parseValidateTicketsResponse(body: string): QueueTicket[] {
  if (!body.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  const rawTickets = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { tickets?: unknown }).tickets)
      ? (parsed as { tickets: unknown[] }).tickets
      : [];

  const tickets: QueueTicket[] = [];
  for (const entry of rawTickets) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const queue = typeof row.queue === "string" ? row.queue : "";
    const itemId =
      typeof row.itemId === "string"
        ? row.itemId
        : typeof row.itemID === "string"
          ? row.itemID
          : "";
    const state = typeof row.state === "string" ? row.state : "";
    if (!queue || !itemId || !state) {
      continue;
    }
    let productName: string | undefined;
    const meta = row.customMetadata;
    if (meta && typeof meta === "object") {
      const item = (meta as { item?: { name?: string } }).item;
      if (item && typeof item.name === "string") {
        productName = item.name;
      }
    }
    tickets.push({ queue, itemId, state, productName });
  }
  return tickets;
}

export function detectQueuePassFromTickets(
  tickets: QueueTicket[],
  seenKeys: ReadonlySet<string>,
): QueuePassEvent[] {
  const events: QueuePassEvent[] = [];
  for (const ticket of tickets) {
    if (ticket.state !== "valid") {
      continue;
    }
    const key = `${ticket.queue}:${ticket.itemId}`;
    if (seenKeys.has(key)) {
      continue;
    }
    events.push({
      queueId: ticket.queue,
      itemId: ticket.itemId,
      productName: ticket.productName,
      source: "network",
    });
  }
  return events;
}

export function hasPendingTickets(tickets: QueueTicket[]): boolean {
  return tickets.some((t) => t.state === "pending");
}

const READY_BUY_RE = /(\d+) item(?:s)? (?:is|are) ready to buy/i;

export function parseReadyToBuyCount(text: string): number | null {
  const match = READY_BUY_RE.exec(text);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}

export function detectQueuePassFromBanner(
  text: string,
  lastReadyCount: number,
): { readyCount: number; newPasses: number } | null {
  const readyCount = parseReadyToBuyCount(text);
  if (readyCount == null || readyCount <= lastReadyCount) {
    return null;
  }
  return { readyCount, newPasses: readyCount - lastReadyCount };
}

export function isProductUrl(url: string): boolean {
  try {
    return /\/ip\/[^/]+/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function extractItemIdFromProductUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && /^\d+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

export function detectQueuePassFromNavigation(
  fromUrl: string,
  toUrl: string,
  seenKeys: ReadonlySet<string>,
): QueuePassEvent | null {
  if (!isQpUrl(fromUrl) || !isProductUrl(toUrl)) {
    return null;
  }
  const itemId = extractItemIdFromProductUrl(toUrl);
  if (!itemId) {
    return null;
  }
  const key = `nav:${itemId}`;
  if (seenKeys.has(key)) {
    return null;
  }
  return { queueId: "nav", itemId, source: "nav" };
}

export function isHoldSpotNavigation(fromUrl: string, toUrl: string): boolean {
  if (!isQpUrl(fromUrl)) {
    return false;
  }
  try {
    const path = new URL(toUrl).pathname.toLowerCase();
    return path === "/" || path === "";
  } catch {
    return false;
  }
}

export function queuePassDedupKey(event: QueuePassEvent): string {
  if (event.source === "nav") {
    return `nav:${event.itemId}`;
  }
  if (event.queueId === "banner") {
    return `banner:${event.productName ?? "ready"}`;
  }
  return `${event.queueId}:${event.itemId}`;
}
