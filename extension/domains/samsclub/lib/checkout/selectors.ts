/** Sam's Club checkout selectors — see extension/domains/samsclub/docs/SAMSCLUB_AUTOMATION.md */
export const CHECKOUT_CONTAINER_SELECTOR = '[data-testid="checkout-container"]';
export const ACTIVE_STEP_HEADING_SELECTOR = "#active-step-heading-text";
export const SAVE_AND_CONTINUE_PREFIX = '[data-test^="save_and_continue_button_step_"]';
export const ADDRESS_SELECTION_RADIO = 'input[name="addressSelection"]';
export const PLACE_ORDER_BUTTON_SELECTOR =
  '[data-automation-id="place-order-button"], [data-testid="place-order-button"]';
export const PLACE_ORDER_ENABLED_SELECTOR =
  '[data-automation-id="place-order-button"]:not([disabled]), [data-testid="place-order-button"]:not([disabled])';
export const AUTH_SIGN_IN_FLYOUT_SELECTOR = '[data-test="@web/auth-components/AuthSignInFlyout"]';
export const STEP_SHIPPING_SELECTOR = "#STEP_SHIPPING";
export const STEP_PAYMENT_SELECTOR = "#STEP_PAYMENT";
export const CHECKOUT_BUTTON_SELECTOR = '[data-automation-id="checkout"]';
export const CHECKOUT_CVV_INPUT_SELECTOR =
  '#cvv-field, input[name="cvv"], input[autocomplete="cc-csc"], input[aria-label*="CVV" i], input[aria-label*="security code" i], input[type="password"][maxlength="3"], input[type="password"][maxlength="4"], input[type="password"][inputmode="numeric"]';
