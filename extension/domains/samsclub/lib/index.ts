export { SAMSCLUB_HOST, isSamsclubHost, isSamsclubUrl, isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";

export {
  applySamsclubOpenTabHighlights,
  isSamsclubOpenTabActive,
  patchSamsclubOpenTabActive,
} from "@ext/domains/samsclub/lib/open-tab-active.ts";

export {
  disambiguateOpenTabLabels,
  labelSamsclubTab,
} from "@ext/domains/samsclub/lib/tab-label.ts";

export {
  getSamsclubRefreshIntervalSec,
  getSamsclubFrontendAtcEnabled,
  getSamsclubBackendAtcEnabled,
  getSamsclubAtcQuantity,
  getSamsclubUseMaxQuantity,
  getSamsclubAutoCheckoutMode,
  shouldEnableSamsclubAutoCheckout,
  normalizeSamsclubRefreshIntervalSec,
  setSamsclubAtcModes,
  setSamsclubAtcQuantity,
  setSamsclubAutoCheckoutMode,
  setSamsclubCheckoutCvv,
  setSamsclubRefreshInterval,
  getSamsclubCheckoutCvv,
  normalizeSamsclubCheckoutCvv,
  SAMSCLUB_AUTO_CHECKOUT_MODES,
} from "@ext/domains/samsclub/lib/channel-config.ts";

export { buildQuantityStatusFields } from "@ext/domains/samsclub/lib/quantity-limit.ts";
