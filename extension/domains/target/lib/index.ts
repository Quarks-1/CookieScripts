export {
  RETAILER_HOST,
  allowlistIncludesRetailerHost,
  isRetailerProductUrl,
  isRetailerUrl,
} from "@ext/domains/target/lib/host.ts";

export {
  getRetailerAtcQuantity,
  getRetailerAutoAtcEnabled,
  getRetailerAutoCheckoutMode,
  shouldEnableRetailerAutoCheckout,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerRefreshIntervalSec,
  getRetailerUseMaxQuantity,
  normalizeRetailerAtcQuantity,
  normalizeRetailerRefreshIntervalSec,
  setRetailerAtcModes,
  setRetailerAtcQuantity,
  setRetailerAutoAtcEnabled,
  setRetailerAutoCheckoutMode,
  setRetailerRefreshInterval,
} from "@ext/domains/target/lib/channel-config.ts";

export { buildQuantityStatusFields } from "@ext/domains/target/lib/quantity-limit.ts";

export {
  applyRetailerOpenTabHighlights,
  isRetailerOpenTabActive,
  patchRetailerOpenTabActive,
} from "@ext/domains/target/lib/open-tab-active.ts";

export {
  buildTargetProductUrlFromSku,
  isTargetAuxiliaryLink,
  normalizeTargetSku,
  normalizeTargetSkuList,
  targetSkuWatchProfile,
} from "@ext/domains/target/lib/sku-watch.ts";

export {
  classifyRetailerPageKind,
  disambiguateOpenTabLabels,
  labelRetailerTab,
} from "@ext/domains/target/lib/tab-label.ts";
