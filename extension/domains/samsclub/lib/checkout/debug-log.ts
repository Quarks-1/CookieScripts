const DEBUG_SERVER_URL = "http://127.0.0.1:9876/log";
const STORAGE_KEY = "samsclub_checkout_debug_log";
const MAX_STORAGE_ENTRIES = 400;
const SENSITIVE_KEY = /cvv|password|card|pan|token|secret/i;

export type SamsclubCheckoutDebugEntry = {
  ts: string;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
};

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) {
    if (value == null || value === "") {
      return value;
    }
    return "<redacted>";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactData(value as Record<string, unknown>);
  }
  return value;
}

function redactData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

async function appendStorage(entry: SamsclubCheckoutDebugEntry): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const prev = Array.isArray(stored[STORAGE_KEY])
      ? (stored[STORAGE_KEY] as SamsclubCheckoutDebugEntry[])
      : [];
    const next = [...prev, entry].slice(-MAX_STORAGE_ENTRIES);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch {
    // Extension context may be invalidated during navigation.
  }
}

function postToDebugServer(entry: SamsclubCheckoutDebugEntry): void {
  try {
    void fetch(DEBUG_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {
      // Debug server not running — storage + console still capture logs.
    });
  } catch {
    // fetch unavailable
  }
}

/** Checkout automation debug line (never logs raw CVV). */
export function samsclubCheckoutDebug(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry: SamsclubCheckoutDebugEntry = {
    ts: new Date().toISOString(),
    scope,
    message,
    data: redactData(data),
  };
  console.info("[samsclub-checkout]", scope, message, entry.data ?? "");
  void appendStorage(entry);
  postToDebugServer(entry);
}

export async function readSamsclubCheckoutDebugLog(): Promise<SamsclubCheckoutDebugEntry[]> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(stored[STORAGE_KEY])
      ? (stored[STORAGE_KEY] as SamsclubCheckoutDebugEntry[])
      : [];
  } catch {
    return [];
  }
}

export async function clearSamsclubCheckoutDebugLog(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    // ignore
  }
}
