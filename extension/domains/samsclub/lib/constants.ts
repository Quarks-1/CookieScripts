export const SAMSCLUB_SESSION_STORAGE_KEY = "cookiescripts:samsclubRecordingSessionId";
export const SAMSCLUB_DISCLAIMER_KEY = "cookiescripts:samsclubDisclaimerAccepted";

export const SAMSCLUB_DB_NAME = "cookiescripts-samsclub-recording";
export const SAMSCLUB_DB_VERSION = 1;

export const MAX_SESSION_BYTES = 25 * 1024 * 1024;
export const MAX_PAGE_HTML_SESSION_BYTES = 8 * 1024 * 1024;
export const MAX_NETWORK_SESSION_BYTES = 17 * 1024 * 1024;
export const MAX_PAGE_HTML_BYTES = 500 * 1024;
export const MAX_NETWORK_BODY_BYTES = 64 * 1024;
export const TRUNCATED_NETWORK_BODY_BYTES = 8 * 1024;
export const MAX_APPEND_CHUNK_BYTES = 512 * 1024;
export const MAX_RETAINED_SESSIONS = 10;

export const SAMSCLUB_PROBE_VERSION = "1.1.0";
export const BUTTON_POLL_MS = 2_000;

export const BATCH_FLUSH_MS = 2_000;
export const BATCH_MAX_EVENTS = 50;
export const DOM_SUMMARY_DEBOUNCE_MS = 2_000;

export const TAB_CLOSE_FLUSH_WAIT_MS = 500;

export const SAMSCLUB_PROBE_EVENT = "cookiescripts:samsclub-probe";
export const SAMSCLUB_PROBE_BRIDGE_ID = "cookiescripts-samsclub-probe-bridge";
export const SAMSCLUB_PROBE_SCRIPT_PATH = "injected/samsclub-research-probe.js";
