import type { ExtensionSettings, SamsclubAutoCheckoutMode } from "@ext/core/types/index.ts";

export const SAMSCLUB_AUTO_CHECKOUT_MODES = new Set<SamsclubAutoCheckoutMode>(["off", "all"]);

export function normalizeSamsclubRefreshIntervalSec(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), 3600);
}

export function getSamsclubRefreshIntervalSec(settings: ExtensionSettings): number {
  return normalizeSamsclubRefreshIntervalSec(settings.samsclub_refresh_interval_sec ?? 0);
}

export function setSamsclubRefreshInterval(
  settings: ExtensionSettings,
  intervalSec: number,
): ExtensionSettings {
  const normalized = normalizeSamsclubRefreshIntervalSec(intervalSec);
  const next = { ...settings };
  if (normalized > 0) {
    next.samsclub_refresh_interval_sec = normalized;
  } else {
    delete next.samsclub_refresh_interval_sec;
  }
  return next;
}

export function getSamsclubFrontendAtcEnabled(settings: ExtensionSettings): boolean {
  return settings.samsclub_frontend_atc_enabled !== false;
}

export function getSamsclubBackendAtcEnabled(settings: ExtensionSettings): boolean {
  return settings.samsclub_backend_atc_enabled === true;
}

export function setSamsclubAtcModes(
  settings: ExtensionSettings,
  modes: { frontend: boolean; backend: boolean },
): ExtensionSettings {
  if (!modes.frontend && !modes.backend) {
    throw new Error("Enable at least one ATC method");
  }
  const next = { ...settings };
  if (modes.frontend) {
    delete next.samsclub_frontend_atc_enabled;
  } else {
    next.samsclub_frontend_atc_enabled = false;
  }
  if (modes.backend) {
    next.samsclub_backend_atc_enabled = true;
  } else {
    delete next.samsclub_backend_atc_enabled;
  }
  return next;
}

export function normalizeSamsclubAtcQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

export function getSamsclubAtcQuantity(settings: ExtensionSettings): number {
  return normalizeSamsclubAtcQuantity(settings.samsclub_atc_quantity ?? 1);
}

export function getSamsclubUseMaxQuantity(settings: ExtensionSettings): boolean {
  return settings.samsclub_use_max_quantity === true;
}

export function setSamsclubAtcQuantity(
  settings: ExtensionSettings,
  options: { quantity: number; useMaxQuantity: boolean },
): ExtensionSettings {
  const quantity = normalizeSamsclubAtcQuantity(options.quantity);
  const next = { ...settings };
  if (quantity === 1) {
    delete next.samsclub_atc_quantity;
  } else {
    next.samsclub_atc_quantity = quantity;
  }
  if (options.useMaxQuantity) {
    next.samsclub_use_max_quantity = true;
  } else {
    delete next.samsclub_use_max_quantity;
  }
  return next;
}

export function getSamsclubAutoCheckoutMode(settings: ExtensionSettings): SamsclubAutoCheckoutMode {
  const mode = settings.samsclub_auto_checkout_mode;
  if (mode === "all") {
    return "all";
  }
  return "off";
}

export function shouldEnableSamsclubAutoCheckout(settings: ExtensionSettings): boolean {
  return getSamsclubAutoCheckoutMode(settings) === "all";
}

export function setSamsclubAutoCheckoutMode(
  settings: ExtensionSettings,
  mode: SamsclubAutoCheckoutMode,
): ExtensionSettings {
  const next = { ...settings };
  if (mode === "off") {
    delete next.samsclub_auto_checkout_mode;
  } else {
    next.samsclub_auto_checkout_mode = mode;
  }
  return next;
}

const SAMSCLUB_CHECKOUT_CVV_PATTERN = /^\d{3}$/;

export function normalizeSamsclubCheckoutCvv(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!SAMSCLUB_CHECKOUT_CVV_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function getSamsclubCheckoutCvv(settings: ExtensionSettings): string | null {
  const raw = settings.samsclub_checkout_cvv;
  if (raw == null || raw === "") {
    return null;
  }
  return normalizeSamsclubCheckoutCvv(raw);
}

export function setSamsclubCheckoutCvv(
  settings: ExtensionSettings,
  cvv: string | null,
): ExtensionSettings {
  const next = { ...settings };
  const normalized = cvv == null ? null : normalizeSamsclubCheckoutCvv(cvv);
  if (normalized == null) {
    delete next.samsclub_checkout_cvv;
  } else {
    next.samsclub_checkout_cvv = normalized;
  }
  return next;
}
