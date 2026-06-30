export type { AutomationStep } from "@ext/domains/target/types/retailer.ts";
export type {
  DomButtonSummary,
  ElementDescriptor,
  EndpointCatalogEntry,
  MarkerLabel,
  PageSnapshotRecord,
  WalmartLastExport,
  WalmartMarkedLabelsState,
  WalmartOpenTabSummary,
  WalmartPageKind,
  WalmartRecordingAction,
  WalmartRecordingEvent,
  WalmartRecordingMetrics,
  WalmartSessionMeta,
} from "@ext/domains/walmart/types/walmart.ts";

export type {
  ActiveTabKind,
  ChannelTarget,
  ExtensionSettings,
  HistoryItem,
  HistoryItemKind,
} from "@ext/core/types/core.ts";
export { DEFAULT_SETTINGS } from "@ext/core/types/core.ts";

export type { ExtensionStatus } from "@ext/core/types/status.ts";

export type {
  BackgroundResponse,
  BackgroundToContent,
  ContentToBackground,
  DetectedDomainsResponse,
  RetailerToBackground,
  RuntimeMessage,
  UiToBackground,
  WalmartToBackground,
  WatchConfig,
} from "@ext/core/types/messages.ts";
