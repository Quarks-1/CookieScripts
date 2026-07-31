import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  onTabRemoved,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { serializeSettingsBackup } from "@ext/core/lib/settings-transfer.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import type { SettingsBackupBundle } from "@ext/core/types/index.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { mockContentSender, mockExtensionPageSender } from "../fixtures/fixtures.ts";

function sampleBackupBundle(): SettingsBackupBundle {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      enabled: false,
      channel_targets: [],
      sku_open_mode_enabled: true,
      samsclub_checkout_cvv: "456",
    },
    ignored_domains: { "1234567890123456789": ["ignored.com"] },
    catalog_view: { groupBy: "type" },
  };
}

function sampleBackupBlob(): string {
  return serializeSettingsBackup(sampleBackupBundle(), {
    exportedAt: "2026-07-31T12:00:00.000Z",
    extensionVersion: "0.1.67",
  });
}

describe("handleMessage — ui", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
  });

  it("accepts SAVE_SETTINGS with empty channel_targets", async () => {
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      {
        type: "SAVE_SETTINGS",
        settings: { enabled: true, channel_targets: [] },
      },
      sender,
    );

    expect(response).toEqual({ ok: true });
  });

  it("clears active channel on tab removed", () => {
    activeChannels.set(5, "222");
    onTabRemoved(5);
    expect(activeChannels.has(5)).toBe(false);
  });

  it("clears dedup keys when history is cleared", async () => {
    recentUrlKeys.add("https://walmart.com/item");
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage({ type: "CLEAR_HISTORY" }, sender);

    expect(response).toEqual({ ok: true });
    expect(recentUrlKeys.size).toBe(0);
  });

  it("persists retailer auto checkout mode", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_AUTO_CHECKOUT_MODE", mode: "all" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      ...DEFAULT_SETTINGS,
      _migrations: { atc_pill_v1: true },
      retailer_auto_checkout_mode: "all",
    });
  });

  it("persists retailer price gate toggle", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_PRICE_GATE_ENABLED", enabled: true },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      ...DEFAULT_SETTINGS,
      _migrations: { atc_pill_v1: true },
      retailer_price_gate_enabled: true,
    });
  });

  it("rejects invalid retailer auto checkout mode", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "SET_RETAILER_AUTO_CHECKOUT_MODE", mode: "invalid" as "all" },
      sender,
    );

    expect(response).toEqual({ ok: false, error: "Invalid auto checkout mode" });
    expect(storage["cookiescripts:settings"]).toEqual(DEFAULT_SETTINGS);
  });

  it("redacts CVV from GET_SETTINGS but includes it in export", async () => {
    const storage = setupChromeMocks();
    storage["cookiescripts:settings"] = {
      ...DEFAULT_SETTINGS,
      samsclub_checkout_cvv: "123",
    };
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const getResponse = await handleMessage({ type: "GET_SETTINGS" }, sender);
    expect(getResponse).toEqual({
      ok: true,
      settings: {
        ...DEFAULT_SETTINGS,
        _migrations: { atc_pill_v1: true },
      },
      settings_import_revision: "",
    });

    const exportResponse = await handleMessage({ type: "EXPORT_SETTINGS_BLOB" }, sender);
    expect(exportResponse && "ok" in exportResponse && exportResponse.ok).toBe(true);
    if (!exportResponse || !("ok" in exportResponse) || exportResponse.ok !== true || !("settings_blob" in exportResponse)) {
      throw new Error("Expected export response");
    }
    expect(exportResponse.contains_cvv).toBe(true);
    expect(exportResponse.settings_blob).toContain('"samsclub_checkout_cvv": "123"');
  });

  it("validates settings blob without writing storage", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);
    const blob = sampleBackupBlob();

    const response = await handleMessage({ type: "VALIDATE_SETTINGS_BLOB", blob }, sender);

    expect(response).toEqual({
      ok: true,
      import_summary: {
        enabled: false,
        discord_channel_count: 0,
        target_sku_count: 0,
        walmart_sku_count: 0,
        enabled_schedules: [],
        contains_cvv: true,
      },
    });
    expect(storage["cookiescripts:settings"]).toEqual(DEFAULT_SETTINGS);
    expect(storage["cookiescripts:ignoredDomains"]).toBeUndefined();
  });

  it("imports settings blob and replaces all backup keys", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);
    const blob = sampleBackupBlob();

    const response = await handleMessage({ type: "IMPORT_SETTINGS_BLOB", blob }, sender);

    expect(response).toMatchObject({ ok: true });
    expect(storage["cookiescripts:settings"]).toMatchObject({
      enabled: false,
      sku_open_mode_enabled: true,
      samsclub_checkout_cvv: "456",
    });
    expect(storage["cookiescripts:ignoredDomains"]).toEqual({
      "1234567890123456789": ["ignored.com"],
    });
    expect(storage["cookiescripts:catalogView"]).toEqual({ groupBy: "type" });
    expect(storage["cookiescripts:settingsImportRevision"]).toEqual(expect.any(String));
  });

  it("rejects a stale full settings save after an import", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);
    const snapshot = await handleMessage({ type: "GET_SETTINGS" }, sender);
    if (!snapshot || !("settings" in snapshot)) {
      throw new Error("Expected settings snapshot");
    }

    await handleMessage({ type: "IMPORT_SETTINGS_BLOB", blob: sampleBackupBlob() }, sender);
    const response = await handleMessage(
      {
        type: "SAVE_SETTINGS",
        settings: { ...snapshot.settings, sku_open_mode_enabled: false },
        expected_import_revision: snapshot.settings_import_revision,
      },
      sender,
    );

    expect(response).toEqual({
      ok: false,
      error: "Settings were imported while this edit was pending. Retry the change.",
    });
    expect(storage["cookiescripts:settings"]).toMatchObject({
      enabled: false,
      sku_open_mode_enabled: true,
      samsclub_checkout_cvv: "456",
    });
  });

  it("rejects invalid import without writing storage", async () => {
    const storage = setupChromeMocks();
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      { type: "IMPORT_SETTINGS_BLOB", blob: "{}" },
      sender,
    );

    expect(response && "ok" in response && response.ok === false).toBe(true);
    expect(storage["cookiescripts:settings"]).toEqual(DEFAULT_SETTINGS);
  });

  it("preserves existing CVV on SAVE_SETTINGS when incoming settings omit it", async () => {
    const storage = setupChromeMocks();
    storage["cookiescripts:settings"] = {
      ...DEFAULT_SETTINGS,
      samsclub_checkout_cvv: "789",
    };
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage(
      {
        type: "SAVE_SETTINGS",
        settings: {
          enabled: true,
          channel_targets: [],
          sku_open_mode_enabled: true,
        },
      },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toMatchObject({
      sku_open_mode_enabled: true,
      samsclub_checkout_cvv: "789",
    });
  });

  it("rejects unauthorized senders for settings transfer messages", async () => {
    const sender = mockContentSender();

    const exportResponse = await handleMessage({ type: "EXPORT_SETTINGS_BLOB" }, sender);
    const validateResponse = await handleMessage(
      { type: "VALIDATE_SETTINGS_BLOB", blob: sampleBackupBlob() },
      sender,
    );
    const importResponse = await handleMessage(
      { type: "IMPORT_SETTINGS_BLOB", blob: sampleBackupBlob() },
      sender,
    );

    expect(exportResponse).toEqual({ ok: false, error: "Unauthorized sender" });
    expect(validateResponse).toEqual({ ok: false, error: "Unauthorized sender" });
    expect(importResponse).toEqual({ ok: false, error: "Unauthorized sender" });
  });
});
