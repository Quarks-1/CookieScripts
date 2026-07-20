import { readOfferIdFromPage } from "@ext/domains/samsclub/lib/cart-context.ts";
import { readSamsclubCartId } from "@ext/domains/samsclub/lib/cart-id.ts";
import {
  ensurePageCartProbeBridge,
  isPageProbeFailure,
  probeInPageContext,
} from "@ext/domains/samsclub/lib/page-cart-probe-bridge.ts";

/** Persisted GraphQL operation hash from live recorder session 2026-07-19. */
export const SAMSCLUB_UPDATE_ITEMS_URL =
  "https://www.samsclub.com/orchestra/cartxo/graphql/updateItems/7476eaf9dcdfc6c2f1c40b5e4fbb828d5e6b68dfa9b42b6af186c20109b9646b";

export const CART_API_PROBE_INTERVAL_MS = 500;

export type CartApiProbeResult =
  | { kind: "added" }
  | { kind: "out_of_stock" }
  | { kind: "blocked" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number }
  | { kind: "network_error" };

export type UpdateItemsInput = {
  usItemId: string;
  offerId: string;
  cartId?: string | null;
  quantity?: number;
  name?: string;
};

type GraphqlErrorBody = {
  data?: { updateItems?: unknown };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export function buildUpdateItemsBody(input: UpdateItemsInput): string {
  const item: Record<string, unknown> = {
    offerId: input.offerId,
    usItemId: input.usItemId,
    quantity: input.quantity ?? 1,
  };
  if (input.name) {
    item.name = input.name;
  }

  const cartInput: Record<string, unknown> = {
    enableLiquorBox: false,
    items: [item],
    skipPolicyCheck: false,
    cartLeanMode: false,
    enableCartSplitClarity: false,
    features: ["lmpdel", "mlrx", "maappl"],
  };
  if (input.cartId) {
    cartInput.cartId = input.cartId;
  }

  return JSON.stringify({
    variables: {
      getDetailedAccesspoint: false,
      input: cartInput,
      includePartialFulfillmentSwitching: false,
      enableAEBadge: false,
      includeExpressSla: false,
      includeQueueing: false,
      enableCartBookslotShortcut: false,
      enableACCScheduling: true,
      enableWalmartPlusFreeDiscountedExpress: true,
      enableDiscountedOrHolidayExpress: true,
      enableBenefitSavings: false,
      enableUnifiedBadges: false,
      enableCartLevelMSI: false,
      enablePickupNotAvailable: false,
      enableReturnsLabel: false,
      enableStarRatings: false,
      enableSpendLimit: false,
      enableMsiMci: true,
      enableTaxBreakdown: false,
      enableI18nWave1: false,
      enableWplusPetBenefit: false,
      enableCartLevelPromotions: false,
      enableOrderCutOffTime: false,
      enableHotCartFeature: false,
      enableMOQ: false,
      enableMOQVariants: false,
      enablePetRxManualRefill: true,
      enableItemLevelCheckout: false,
      enableSuggestedSlotAvailability: true,
      enablePFS: true,
      enableSubscriptionsInTransaction: true,
      enableSubscribeToSaveNudge: false,
      enableE2EPickupEnhancement: false,
      enableExpressPickup: false,
      enableB2BCategoryRestriction: false,
      enableSubscriptionDiscounts: false,
      enablePromoDiscount: false,
      enableWplusACCPayForServiceOnline: false,
      includeItemPackaging: false,
      enableMultiStorePickup: false,
      enableShopAllNode: false,
      enableWFSGlobal: false,
      includeFulfillmentSwitchOptions: false,
      enableMaxItemAllowedForRegularSlot: false,
      enableAvailableFinancingOptions: false,
      enableFreeDeliveryThreshold: false,
      enableShippingOptions: true,
      enableShippingFeeClarity: false,
      getPriceInfoDetails: false,
      enableAccQuantityNudge: false,
      enableFeeThresholdBar: false,
      enableWic: false,
      enableColdChainExpansion: false,
      enableGEP: false,
      enableIsEligibleForFreeTrialV1: false,
      enableMaximumThreshold: false,
      enableSellerFeeBreakdown: false,
      enablePaymentMethodPromotion: false,
      enablePreferredStore: false,
      enableUnscheduledPickup: false,
      enableUnscheduledShippingOptions: false,
      enableItemDeliveryPrice: false,
      enableShowSavingsGrandTotal: false,
      enableSparkStore: false,
      enableVolumePricing: false,
      enableStreamlinedBadges: false,
      enableFIGCartFulfillmentOption: true,
      enableExpressReservationEndTime: false,
      subscriptionInTransactionAndDetailed: false,
      enablePriceDetailsSavings: false,
      enableItemTypeAttributes: true,
      includeFitment: true,
      enablePromotionalMetaData: true,
      enableEligibleCareplans: true,
      enableShowACCSchedulingInCart: true,
      enableAOSLineItemId: true,
      enableSubscriptionsInTransactionDiscount: false,
      enableDestinationTax: false,
      enableStaticMessageType: true,
      enableEachWeightItem: false,
      enableOptimisticWeightUpdate: false,
      enableAOSPriceChangeExp: false,
      enableAOSWplusPriceChange: false,
      enableCheckoutableErrorAttributes: false,
      enableFlowerDelivery: true,
      enableOutOfCountry: false,
      enableExpressStoreBadge: false,
      enableAllowItemQtyEditable: true,
      enableAllowItemRemoval: true,
      enableAllowSaveForLaterForItem: true,
      enableVPForACCItems: false,
      enableSpecialOrderMultiline: false,
      enableIntentControl: false,
      enableAOSModuleAttribute: false,
      enableLocalizedStringForReservation: true,
      enableAOSRearchitect: false,
      enableAOSWplusDiscount: false,
      enableDynamicExpressSlotType: false,
      enableWcpEligibility: false,
      enableBadges: false,
      enablePayForSpeed: false,
      enableDroneDelivery: false,
      enableCCAFlow: false,
      enableRxpd: false,
      enableRxpdLunchHours: false,
      enableIsTobaccoField: true,
      enableCustomizableItemsPhase1: false,
      enableQsr4w: false,
      enableWplusSubscribeAndSave: false,
      enableTheFarmersDog: false,
      enableExpressAvailability: false,
      detailed: false,
      includeExtras: true,
      includeMpGroup: false,
      includeClipRewards: false,
      enableWeightedItems: false,
      enableDetailedBeacon: false,
      enableOrderLimit: false,
      includeGrandAndSavedSubtotal: false,
      enableQSRImplicitReservation: false,
      includeGepShippingThresholdData: false,
      enableGicEngagement: false,
      enableUpstreamErrorCode: true,
      includeFulfillmentBadge: true,
      includeFulfillmentItemGroups: false,
      includeOtherDetailed: true,
      includeWeeklyReservation: false,
      enableSavingsBreakup: false,
      fetchAddOnServices: false,
    },
  });
}

/** @deprecated Use buildUpdateItemsBody */
export function buildAddToCartBody(usItemId: string, quantity = 1): { usItemId: string; quantity: number } {
  return { usItemId, quantity };
}

export function parseCartApiProbeResponse(
  status: number,
  body: unknown,
): CartApiProbeResult {
  if (status === 200 && body && typeof body === "object") {
    const parsed = body as GraphqlErrorBody;
    if (parsed.data?.updateItems) {
      return { kind: "added" };
    }
    const message = parsed.errors?.[0]?.message?.toLowerCase() ?? "";
    const code = parsed.errors?.[0]?.extensions?.code?.toLowerCase() ?? "";
    if (
      message.includes("inventory") ||
      message.includes("out of stock") ||
      message.includes("unavailable") ||
      code.includes("inventory")
    ) {
      return { kind: "out_of_stock" };
    }
  }

  if (status === 401) {
    return { kind: "unauthorized" };
  }

  if (status === 403 || status === 412 || status === 418 || status === 429 || status === 456 || status === 521) {
    return { kind: "blocked" };
  }

  if (status === 424) {
    return { kind: "out_of_stock" };
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
    const response = await fetchFn(SAMSCLUB_UPDATE_ITEMS_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
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
  usItemId: string,
  deps: CartApiProbeDeps = {},
  quantity = 1,
): Promise<CartApiProbeResult> {
  const doc = deps.document ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) {
    return { kind: "network_error" };
  }

  const offerId = readOfferIdFromPage(doc, usItemId);
  if (!offerId) {
    return { kind: "error", status: 0 };
  }

  const cartId = readSamsclubCartId(doc.defaultView?.localStorage ?? null);
  const bodyJson = buildUpdateItemsBody({
    usItemId,
    offerId,
    cartId,
    quantity,
  });

  const ensureBridge = deps.ensureBridge ?? ensurePageCartProbeBridge;
  const pageProbe = deps.probeInPageContext ?? probeInPageContext;
  const fetchFn = deps.fetchFn ?? globalThis.fetch;

  if (canUsePageCartProbeBridge(doc)) {
    const bridge = await ensureBridge(doc, deps.getScriptUrl);
    if (bridge === "ready") {
      try {
        const pageResult = await pageProbe(SAMSCLUB_UPDATE_ITEMS_URL, bodyJson, { doc });
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
