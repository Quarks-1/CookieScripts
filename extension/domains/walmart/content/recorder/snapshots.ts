import { readCookieNames } from "@ext/domains/walmart/lib/cookie-names.ts";
import { extractEmbeddedPageData } from "@ext/domains/walmart/content/recorder/embedded-data.ts";
import { stripExtensionArtifacts } from "@ext/domains/walmart/lib/html-cleanup.ts";
import {
  addPageBytes,
  capPageHtml,
  estimateBytes,
  type SessionLimitState,
} from "@ext/domains/walmart/lib/recording-limits.ts";
import { scanDomSummary } from "@ext/domains/walmart/content/recorder/dom-summary.ts";
import type {
  PageSnapshotRecord,
  PaymentIframeSnapshot,
  WalmartRecordingEvent,
} from "@ext/domains/walmart/types/walmart.ts";

export type SnapshotResult = {
  event: WalmartRecordingEvent;
  page: PageSnapshotRecord;
  byteDelta: number;
};

function capturePaymentIframe(): PaymentIframeSnapshot | undefined {
  const mount = document.querySelector('[data-testid="pciContent"]');
  if (!(mount instanceof HTMLElement)) {
    return undefined;
  }
  const iframe = mount.querySelector("iframe");
  return {
    testId: "pciContent",
    src: iframe?.getAttribute("src") ?? undefined,
  };
}

function captureDialogHtml(): string | undefined {
  const dialog = document.querySelector("[role='dialog'], [aria-modal='true']");
  if (!(dialog instanceof HTMLElement)) {
    return undefined;
  }
  return dialog.outerHTML.slice(0, 64_000);
}

export function capturePageSnapshot(
  trigger: string,
  limitState: SessionLimitState,
): { result: SnapshotResult | null; limitState: SessionLimitState } {
  const { buttons } = scanDomSummary();
  const rawHtml = stripExtensionArtifacts(document.documentElement.outerHTML);
  const { html, bytes: htmlBytes } = capPageHtml(rawHtml, limitState);
  if (!html && htmlBytes === 0) {
    return { result: null, limitState };
  }

  const pageId = crypto.randomUUID();
  const page: PageSnapshotRecord = {
    pageId,
    url: location.href,
    title: document.title,
    htmlTruncated: html,
    domSummary: buttons,
    capturedAt: new Date().toISOString(),
    trigger,
    embedded: extractEmbeddedPageData(),
    dialogHtml: captureDialogHtml(),
    paymentIframe: capturePaymentIframe(),
    cookieNames: readCookieNames(),
  };

  const event: WalmartRecordingEvent = {
    kind: "page_snapshot",
    ts: new Date().toISOString(),
    url: location.href,
    trigger,
    pageId,
  };

  const payloadBytes = estimateBytes(page) + estimateBytes(event);
  const nextState = addPageBytes(limitState, payloadBytes);
  return {
    result: { event, page, byteDelta: payloadBytes },
    limitState: nextState,
  };
}
