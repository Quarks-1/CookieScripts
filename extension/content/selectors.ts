/** Discord layout verified 2026-06-27 — patch here when selectors break. */
export const SELECTOR_VERSION = "2026-06-27";

export const MESSAGE_LIST = '[class*="messagesWrapper"] [class*="scroller"]';
export const MESSAGE_ARTICLE =
  '[class*="message"][role="article"], [id^="chat-messages-"] [class*="message"]';
export const MESSAGE_CONTENT = '[class*="messageContent"]';
export const EMBED = '[class*="embed"]';
export const AUTHOR = '[class*="username"]';

/** Best-effort own-message detection — verify cozy/compact/mobile layouts. */
export const OWN_MESSAGE = '[class*="message"][class*="local"]';

/**
 * Message snowflake: element.id matching chat-messages-<snowflake> or data-list-item-id.
 * Verify once whether article textContent excludes embed text; only then add embed subtree walk.
 */
