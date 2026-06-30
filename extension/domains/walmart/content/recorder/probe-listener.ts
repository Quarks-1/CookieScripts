import { graphqlSignalForOperation, isOrchestraFailureStatus } from "@ext/domains/walmart/lib/graphql-signals.ts";
import { redactBodySnippet, redactHeaders } from "@ext/domains/walmart/lib/network-redact.ts";
import {
  addNetworkBytes,
  estimateBytes,
  networkBodyLimit,
  type SessionLimitState,
} from "@ext/domains/walmart/lib/recording-limits.ts";
import { parseGraphqlOperation, redactUrl, resolveAbsoluteUrl } from "@ext/domains/walmart/lib/url.ts";
import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

export function probeDetailToEvent(
  detail: Record<string, unknown>,
  limitState: SessionLimitState,
): { event: WalmartRecordingEvent | null; limitState: SessionLimitState } {
  const cap = networkBodyLimit(limitState);
  const ts = new Date().toISOString();
  const baseUrl = typeof detail.pageUrl === "string" ? detail.pageUrl : location.href;
  const rawUrl = String(detail.url ?? "");
  const absoluteUrl = redactUrl(resolveAbsoluteUrl(rawUrl, baseUrl), baseUrl);

  if (detail.kind === "websocket") {
    const event: WalmartRecordingEvent = {
      kind: "websocket",
      ts,
      correlationId:
        typeof detail.correlationId === "string" ? detail.correlationId : undefined,
      direction: detail.direction as "open" | "send" | "message" | "close",
      url: rawUrl,
      absoluteUrl,
      payloadSnippet: redactBodySnippet(
        typeof detail.payloadSnippet === "string" ? detail.payloadSnippet : undefined,
        cap,
      ),
      code: typeof detail.code === "number" ? detail.code : undefined,
    };
    const bytes = estimateBytes(event);
    return { event, limitState: addNetworkBytes(limitState, bytes) };
  }

  if (detail.kind === "network") {
    const graphqlOperation =
      typeof detail.graphqlOperation === "string"
        ? detail.graphqlOperation
        : parseGraphqlOperation(rawUrl, baseUrl);
    const status = typeof detail.status === "number" ? detail.status : undefined;
    const event: WalmartRecordingEvent = {
      kind: "network",
      ts,
      correlationId:
        typeof detail.correlationId === "string" ? detail.correlationId : undefined,
      transport: detail.transport as "fetch" | "xhr" | "beacon" | "resource",
      method: String(detail.method ?? "GET"),
      url: rawUrl,
      absoluteUrl,
      graphqlOperation,
      graphqlSignal: graphqlSignalForOperation(graphqlOperation),
      status,
      requestBody: redactBodySnippet(
        typeof detail.requestBody === "string" ? detail.requestBody : undefined,
        cap,
      ),
      responseSnippet: redactBodySnippet(
        typeof detail.responseSnippet === "string" ? detail.responseSnippet : undefined,
        cap,
      ),
      requestHeaders:
        detail.requestHeaders && typeof detail.requestHeaders === "object"
          ? redactHeaders(detail.requestHeaders as Record<string, string>)
          : undefined,
      responseHeaders:
        detail.responseHeaders && typeof detail.responseHeaders === "object"
          ? redactHeaders(detail.responseHeaders as Record<string, string>)
          : undefined,
      durationMs: typeof detail.durationMs === "number" ? detail.durationMs : undefined,
      failed: detail.failed === true || isOrchestraFailureStatus(status),
    };
    const bytes = estimateBytes(event);
    return { event, limitState: addNetworkBytes(limitState, bytes) };
  }

  return { event: null, limitState };
}
