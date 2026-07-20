export type MarkerLabel =
  | "Blocked"
  | "Search"
  | "Product page"
  | "Add to cart"
  | "Cart page"
  | "Pre-checkout"
  | "Post-checkout";

export type ElementDescriptor = {
  id: string;
  label: string;
  selectors: string[];
  ariaLabel?: string;
  dataAutomationId?: string;
  dataTestId?: string;
  dcaEvent?: string;
  dcaAid?: string;
  dcaIntent?: string;
  role?: string;
  tagName: string;
  recordedAt: string;
  pageUrlPattern: string;
  brittle: boolean;
};

export type DomButtonSummary = {
  tag: string;
  id: string | null;
  dataAutomationId: string | null;
  dataTestId: string | null;
  ariaLabel: string | null;
  disabled: boolean | null;
  text: string;
};

export type EmbeddedDataHints = {
  page?: string;
  itemId?: string;
  offerId?: string;
  availabilityStatus?: string;
  cartId?: string;
};

export type PaymentIframeSnapshot = {
  testId: string;
  src?: string;
};

export type EmbeddedPageData = {
  nextData?: string;
  embeddedHints?: EmbeddedDataHints;
  jsonLd: string[];
};

export type PageSnapshotRecord = {
  pageId: string;
  url: string;
  title: string;
  htmlTruncated: string;
  domSummary: DomButtonSummary[];
  capturedAt: string;
  trigger: string;
  tabId?: number;
  embedded?: EmbeddedPageData;
  dialogHtml?: string;
  paymentIframe?: PaymentIframeSnapshot;
  cookieNames?: string[];
};

export type SamsclubRecordingEvent =
  | { kind: "session_start"; ts: string; url: string; tabId?: number }
  | { kind: "session_stop"; ts: string; url: string }
  | { kind: "tab_join"; ts: string; tabId: number; url: string }
  | { kind: "tab_leave"; ts: string; tabId: number; url: string }
  | { kind: "probe_ready"; ts: string; url: string; latencyMs: number; probeVersion: string; tabId?: number }
  | { kind: "click"; ts: string; url: string; descriptor: ElementDescriptor; tabId?: number }
  | { kind: "navigation"; ts: string; from: string; to: string; tabId?: number }
  | {
      kind: "network";
      ts: string;
      correlationId?: string;
      transport: "fetch" | "xhr" | "beacon" | "resource";
      method: string;
      url: string;
      absoluteUrl?: string;
      graphqlOperation?: string;
      status?: number;
      requestBody?: string;
      responseSnippet?: string;
      requestHeaders?: Record<string, string>;
      responseHeaders?: Record<string, string>;
      durationMs?: number;
      failed?: boolean;
      graphqlSignal?: string;
      tabId?: number;
    }
  | {
      kind: "websocket";
      ts: string;
      correlationId?: string;
      direction: "open" | "send" | "message" | "close";
      url: string;
      absoluteUrl?: string;
      payloadSnippet?: string;
      code?: number;
      tabId?: number;
    }
  | { kind: "page_snapshot"; ts: string; url: string; trigger: string; pageId: string; tabId?: number }
  | {
      kind: "dom_summary";
      ts: string;
      url: string;
      trigger: string;
      buttons: DomButtonSummary[];
      landmarks: string[];
      signals: string[];
      tabId?: number;
    }
  | { kind: "storage_keys"; ts: string; local: string[]; session: string[]; tabId?: number }
  | { kind: "cookie_names"; ts: string; names: string[]; tabId?: number }
  | {
      kind: "button_state";
      ts: string;
      url: string;
      selector: string;
      label: string;
      disabled: boolean;
      tabId?: number;
    }
  | { kind: "form_submit"; ts: string; url: string; action: string; method: string; tabId?: number }
  | { kind: "marker"; ts: string; label: MarkerLabel; tabId?: number }
  | { kind: "auto_marker"; ts: string; label: MarkerLabel; url: string; detail?: string; tabId?: number };

export type EndpointCatalogEntry = {
  method: string;
  host: string;
  pathnamePattern: string;
  graphqlOperation?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleRequestBody?: string;
};

export type SamsclubSessionMeta = {
  sessionId: string;
  tabId: number;
  tabIds: number[];
  primaryTabId: number | null;
  failedAttachTabIds: number[];
  startedAt: string;
  stoppedAt?: string;
  dropDate: string;
  sessionTime: string;
  url: string;
  userAgent: string;
  truncated: boolean;
  droppedEvents: number;
  byteTotal: number;
  exportedAt?: string;
  extensionVersion?: string;
  probeVersion?: string;
};

export type SamsclubLastExport = {
  downloadId: number;
  filename: string;
  exportedAt: string;
  sessionId: string;
};

export type SamsclubRecordingMetrics = {
  sessionId: string | null;
  eventCount: number;
  bytes: number;
  dropDate: string | null;
  recordingActive: boolean;
  startedAt: string | null;
};

export type SamsclubMarkedLabelsState = {
  sessionId: string;
  labels: MarkerLabel[];
};

export type SamsclubRecordingAction = "start" | "stop" | "mark" | "clear" | "export";

export type SamsclubPageKind =
  | "home"
  | "product"
  | "cart"
  | "checkout"
  | "post_checkout"
  | "order_confirmation"
  | "search"
  | "blocked"
  | "other";

export interface SamsclubOpenTabSummary {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  label: string;
  pageKind: SamsclubPageKind;
  isActive: boolean;
  isRecording: boolean;
}

export type SamsclubAutoCheckoutMode = "off" | "all";
