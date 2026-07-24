import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";
import { useLiveScheduleStatus } from "../../../core/hooks/useLiveScheduleStatus.ts";

type WalmartScheduleStatus = Pick<
  ExtensionStatus,
  | "walmart_schedule_enabled"
  | "walmart_schedule_start_time"
  | "walmart_schedule_end_time"
  | "walmart_schedule_status"
  | "walmart_schedule_phase"
>;

export function useWalmartSchedule(
  panelActive: boolean,
  status: WalmartScheduleStatus | null,
  onRefresh?: () => Promise<void>,
) {
  const [enabled, setEnabled] = useState(() => status?.walmart_schedule_enabled ?? false);
  const [startTime, setStartTime] = useState(() => status?.walmart_schedule_start_time ?? "");
  const [endTime, setEndTime] = useState(() => status?.walmart_schedule_end_time ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scheduleStatus = useLiveScheduleStatus({
    enabled,
    phase: status?.walmart_schedule_phase ?? "off",
    startTime: status?.walmart_schedule_start_time ?? null,
    endTime: status?.walmart_schedule_end_time ?? null,
    serverStatus: status?.walmart_schedule_status ?? "",
  });

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setEnabled(response.status.walmart_schedule_enabled);
      setStartTime(response.status.walmart_schedule_start_time ?? "");
      setEndTime(response.status.walmart_schedule_end_time ?? "");
    }
  }, []);

  useEffect(() => {
    if (!panelActive || status == null || saving) {
      return;
    }
    setEnabled(status.walmart_schedule_enabled);
    setStartTime(status.walmart_schedule_start_time ?? "");
    setEndTime(status.walmart_schedule_end_time ?? "");
  }, [panelActive, status, saving]);

  const save = useCallback(
    async (patch: {
      enabled?: boolean;
      start_time?: string;
      end_time?: string;
    }) => {
      setSaving(true);
      setSaveError(null);
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_WALMART_SCHEDULE",
          ...patch,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
        await onRefresh?.();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        await refresh();
        await onRefresh?.();
      } finally {
        setSaving(false);
      }
    },
    [refresh, onRefresh],
  );

  const handleEnabledChange = useCallback(
    (next: boolean) => {
      if (next && startTime.trim() === "") {
        setSaveError("Set a start time first, then enable schedule");
        return;
      }
      setSaveError(null);
      setEnabled(next);
      void save({ enabled: next });
    },
    [save, startTime],
  );

  const commitStartTime = useCallback(
    (next: string) => {
      setStartTime(next);
      if (next.trim() !== "") {
        setSaveError(null);
      }
      void save({ start_time: next });
    },
    [save],
  );

  const commitEndTime = useCallback(
    (next: string) => {
      setEndTime(next);
      void save({ end_time: next });
    },
    [save],
  );

  return {
    enabled,
    startTime,
    endTime,
    scheduleStatus,
    saving,
    saveError,
    handleEnabledChange,
    commitStartTime,
    commitEndTime,
  };
}
