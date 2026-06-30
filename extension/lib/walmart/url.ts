import { redactBodySnippet } from "@ext/lib/walmart/network-redact.ts";

const WALMART_ORIGIN = "https://www.walmart.com";

const SENSITIVE_URL_PARAM =
  /^(firstName|lastName|email|phone|password|token|cid|vtc|bstc|customerId|address)$/i;

export function resolveAbsoluteUrl(url: string, base = WALMART_ORIGIN): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

export function parseGraphqlOperation(url: string, base = WALMART_ORIGIN): string | undefined {
  try {
    const pathname = new URL(url, base).pathname;
    const match = pathname.match(/\/graphql\/([^/]+)\//);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function redactUrl(url: string, base = WALMART_ORIGIN): string {
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_URL_PARAM.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    const variables = parsed.searchParams.get("variables");
    if (variables) {
      parsed.searchParams.set("variables", redactBodySnippet(variables, 32_768) ?? "[REDACTED]");
    }
    return parsed.href;
  } catch {
    return url;
  }
}
