import { useCallback, useEffect, useState, type FormEvent } from "react";

import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/lib/messages.ts";
import { validateChannelTargets } from "@ext/lib/validate.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";
import {
  draftsToTargets,
  newDraft,
  settingsFingerprint,
  targetsToDrafts,
  type ChannelTargetDraft,
} from "@shared/lib/channelTargetDrafts.ts";

export interface WatchTargetsEditorState {
  drafts: ChannelTargetDraft[];
  dirty: boolean;
  disabled: boolean;
  targetError: string | null;
  targetSuccess: string | null;
  savingTarget: boolean;
  externalChange: boolean;
  updateDraft: (
    key: string,
    updater: (draft: ChannelTargetDraft) => ChannelTargetDraft,
  ) => void;
  addChannel: () => void;
  removeChannel: (key: string) => void;
  handleTargetSave: (event: FormEvent) => Promise<void>;
  reloadFromSettings: (settings: ExtensionSettings) => void;
  dismissExternalChange: () => void;
}

export function useWatchTargetsEditor(
  settings: ExtensionSettings | null,
  enabled: boolean,
  onSettingsRefreshed?: (settings: ExtensionSettings) => void,
): WatchTargetsEditorState {
  const [drafts, setDrafts] = useState<ChannelTargetDraft[]>(() =>
    settings ? targetsToDrafts(settings.channel_targets) : [newDraft()],
  );
  const [dirty, setDirty] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetSuccess, setTargetSuccess] = useState<string | null>(null);
  const [externalChange, setExternalChange] = useState(false);

  const fingerprint = settings ? settingsFingerprint(settings) : null;

  const reloadFromSettings = useCallback((next: ExtensionSettings) => {
    setDrafts(targetsToDrafts(next.channel_targets));
    setDirty(false);
    setExternalChange(false);
    setTargetError(null);
    setTargetSuccess(null);
  }, []);

  useEffect(() => {
    if (!settings || dirty) {
      return;
    }
    reloadFromSettings(settings);
  }, [fingerprint, dirty, settings, reloadFromSettings]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area !== "local" || !changes[STORAGE_KEYS.settings]) {
        return;
      }
      void (async () => {
        try {
          const next = await getExtensionSettings();
          onSettingsRefreshed?.(next);
          setDirty((isDirty) => {
            if (isDirty) {
              setExternalChange(true);
              return true;
            }
            reloadFromSettings(next);
            return false;
          });
        } catch {
          // ignore transient read failures
        }
      })();
    }

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [onSettingsRefreshed, reloadFromSettings]);

  const updateDraft = useCallback(
    (key: string, updater: (draft: ChannelTargetDraft) => ChannelTargetDraft) => {
      setDirty(true);
      setExternalChange(false);
      setTargetError(null);
      setTargetSuccess(null);
      setDrafts((current) =>
        current.map((draft) => (draft.key === key ? updater(draft) : draft)),
      );
    },
    [],
  );

  const addChannel = useCallback(() => {
    setDirty(true);
    setExternalChange(false);
    setTargetError(null);
    setTargetSuccess(null);
    setDrafts((current) => [...current, newDraft()]);
  }, []);

  const removeChannel = useCallback((key: string) => {
    setDirty(true);
    setExternalChange(false);
    setTargetError(null);
    setTargetSuccess(null);
    setDrafts((current) => {
      if (current.length === 1) {
        return [newDraft()];
      }
      return current.filter((draft) => draft.key !== key);
    });
  }, []);

  const handleTargetSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setTargetError(null);
      setTargetSuccess(null);

      const targets = draftsToTargets(drafts);
      const validationError = validateChannelTargets(targets);
      if (validationError) {
        setTargetError(validationError);
        return;
      }

      setSavingTarget(true);
      try {
        await saveExtensionSettings({ enabled, channel_targets: targets });
        const next = await getExtensionSettings();
        reloadFromSettings(next);
        onSettingsRefreshed?.(next);
        setTargetSuccess("Watch targets saved");
      } catch (error) {
        setTargetError(error instanceof Error ? error.message : "Save failed");
      } finally {
        setSavingTarget(false);
      }
    },
    [drafts, enabled, onSettingsRefreshed, reloadFromSettings],
  );

  const dismissExternalChange = useCallback(() => setExternalChange(false), []);

  return {
    drafts,
    dirty,
    disabled: savingTarget,
    targetError,
    targetSuccess,
    savingTarget,
    externalChange,
    updateDraft,
    addChannel,
    removeChannel,
    handleTargetSave,
    reloadFromSettings,
    dismissExternalChange,
  };
}
