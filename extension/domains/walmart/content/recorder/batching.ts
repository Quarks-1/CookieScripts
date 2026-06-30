import { BATCH_FLUSH_MS, BATCH_MAX_EVENTS } from "@ext/domains/walmart/lib/constants.ts";
import { estimateBytes } from "@ext/domains/walmart/lib/recording-limits.ts";
import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";
import type { PageSnapshotRecord, WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export type BatchFlushPayload = {
  events: WalmartRecordingEvent[];
  pages: PageSnapshotRecord[];
  byteDelta: number;
  droppedEvents: number;
  truncated: boolean;
};

export class RecordingBatcher {
  private events: WalmartRecordingEvent[] = [];
  private pages: PageSnapshotRecord[] = [];
  private byteDelta = 0;
  private droppedEvents = 0;
  private truncated = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;

  private onFlushError?: (error: unknown) => void;

  constructor(onFlushError?: (error: unknown) => void) {
    this.onFlushError = onFlushError;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  enqueue(event: WalmartRecordingEvent, byteDelta = 0): void {
    this.events.push(event);
    this.byteDelta += byteDelta;
    if (this.events.length >= BATCH_MAX_EVENTS) {
      void this.flush();
      return;
    }
    this.schedule();
  }

  enqueuePage(event: WalmartRecordingEvent, page: PageSnapshotRecord, byteDelta: number): void {
    this.events.push(event);
    this.pages.push(page);
    this.byteDelta += byteDelta;
    if (this.events.length >= BATCH_MAX_EVENTS) {
      void this.flush();
      return;
    }
    this.schedule();
  }

  markTruncated(): void {
    this.truncated = true;
  }

  markDropped(count = 1): void {
    this.droppedEvents += count;
  }

  schedule(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, BATCH_FLUSH_MS);
  }

  async flush(): Promise<void> {
    if (!this.sessionId || (this.events.length === 0 && this.pages.length === 0)) {
      return;
    }
    const payload: BatchFlushPayload = {
      events: this.events,
      pages: this.pages,
      byteDelta: this.byteDelta,
      droppedEvents: this.droppedEvents,
      truncated: this.truncated,
    };
    this.events = [];
    this.pages = [];
    this.byteDelta = 0;
    this.droppedEvents = 0;
    this.truncated = false;

    try {
      await sendToBackground<BackgroundResponse>({
        type: "WALMART_RECORDING_APPEND",
        sessionId: this.sessionId,
        events: payload.events,
        pages: payload.pages.length > 0 ? payload.pages : undefined,
        byteDelta: payload.byteDelta,
        droppedEvents: payload.droppedEvents,
        truncated: payload.truncated,
      });
    } catch (error) {
      this.onFlushError?.(error);
    }
  }

  estimateQueuedBytes(): number {
    return estimateBytes({ events: this.events, pages: this.pages });
  }
}
