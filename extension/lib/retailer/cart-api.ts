import {
  ensurePageCartProbeBridge,
  isPageProbeFailure,
  probeInPageContext,
} from "@ext/lib/retailer/page-cart-probe-bridge.ts";

export const TARGET_CART_API_KEY =
  "9f36aeafbe60771e321a7cc95a78140772ab3e96";

export const TARGET_CART_ITEMS_URL =
  `https://carts.target.com/web_checkouts/v1/cart_items?field_groups=CART,CART_ITEMS,SUMMARY&key=${TARGET_CART_API_KEY}`;

export const TARGET_CART_WARMUP_URL =
  `https://carts.target.com/web_checkouts/v1/cart?cart_type=REGULAR&field_groups=CART,CART_ITEMS,SUMMARY&key=${TARGET_CART_API_KEY}`;

export const CART_API_PROBE_INTERVAL_MS = 500;

export type CartApiProbeResult =
  | { kind: "added" }
  | { kind: "out_of_stock" }
  | { kind: "blocked" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number }
  | { kind: "network_error" };

export type AddToCartBody = {
  cart_item: {
    item_channel_id: string;
    tcin: string;
    quantity: number;
  };
  cart_type: string;
  channel_id: string;
  shopping_context: string;
};

type CartApiAlert = {
  code?: string;
};

type CartApiErrorBody = {
  code?: string;
  alerts?: CartApiAlert[];
  errorKey?: string;
};

export function buildAddToCartBody(tcin: string, quantity = 1): AddToCartBody {
  return {
    cart_item: {
      item_channel_id: "10",
      tcin,
      quantity,
    },
    cart_type: "REGULAR",
    channel_id: "10",
    shopping_context: "DIGITAL",
  };
}

export function isTargetAuthDeniedBody(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }
  return (body as CartApiErrorBody).errorKey === "_ERR_AUTH_DENIED";
}

export function parseCartApiProbeResponse(
  status: number,
  body: unknown,
): CartApiProbeResult {
  if (status === 201) {
    return { kind: "added" };
  }

  if (status === 401 || isTargetAuthDeniedBody(body)) {
    return { kind: "unauthorized" };
  }

  if (status === 403) {
    return { kind: "blocked" };
  }

  if (status === 424) {
    return { kind: "out_of_stock" };
  }

  if (body && typeof body === "object") {
    const parsed = body as CartApiErrorBody;
    const alertCode = parsed.alerts?.[0]?.code;
    if (alertCode === "INVENTORY_UNAVAILABLE" || parsed.code === "DEPENDENT_SERVICE_ERROR") {
      return { kind: "out_of_stock" };
    }
  }

  return { kind: "error", status };
}

export function shouldRunCartApiProbe(
  nowMs: number,
  lastProbeMs: number | null,
  intervalMs = CART_API_PROBE_INTERVAL_MS,
): boolean {
  if (lastProbeMs === null) {
    return true;
  }
  return nowMs - lastProbeMs >= intervalMs;
}

export type CartApiProbeDeps = {
  document?: Document;
  ensureBridge?: typeof ensurePageCartProbeBridge;
  probeInPageContext?: typeof probeInPageContext;
  fetchFn?: typeof fetch;
  getScriptUrl?: () => string;
};

async function probeViaContentScriptFetch(
  fetchFn: typeof fetch,
  bodyJson: string,
): Promise<CartApiProbeResult> {
  try {
    const response = await fetchFn(TARGET_CART_ITEMS_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-application-name": "web",
      },
      body: bodyJson,
    });

    let body: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    }

    return parseCartApiProbeResponse(response.status, body);
  } catch {
    return { kind: "network_error" };
  }
}

function canUsePageCartProbeBridge(doc: Document | undefined): doc is Document {
  return (
    doc !== undefined &&
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.getURL === "function"
  );
}

export async function probeAddToCartViaApi(
  tcin: string,
  deps: CartApiProbeDeps = {},
  quantity = 1,
): Promise<CartApiProbeResult> {
  const bodyJson = JSON.stringify(buildAddToCartBody(tcin, quantity));
  const doc = deps.document ?? (typeof document !== "undefined" ? document : undefined);
  const ensureBridge = deps.ensureBridge ?? ensurePageCartProbeBridge;
  const pageProbe = deps.probeInPageContext ?? probeInPageContext;
  const fetchFn = deps.fetchFn ?? globalThis.fetch;

  if (canUsePageCartProbeBridge(doc)) {
    const bridge = await ensureBridge(doc, deps.getScriptUrl);
    if (bridge === "ready") {
      try {
        const pageResult = await pageProbe(TARGET_CART_ITEMS_URL, bodyJson, { doc });
        if (!isPageProbeFailure(pageResult)) {
          return parseCartApiProbeResponse(pageResult.status, pageResult.body);
        }
        return { kind: "network_error" };
      } catch {
        return { kind: "network_error" };
      }
    }

    if (bridge === "failed") {
      return probeViaContentScriptFetch(fetchFn, bodyJson);
    }

    return { kind: "network_error" };
  }

  return probeViaContentScriptFetch(fetchFn, bodyJson);
}
