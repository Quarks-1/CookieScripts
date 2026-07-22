import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";
import { useLiveScheduleStatus } from "../../../core/hooks/useLiveScheduleStatus.ts";

type SamsclubScheduleStatus = Pick<
  ExtensionStatus,
  | "samsclub_schedule_enabled"
  | "samsclub_schedule_start_time"
  | "samsclub_schedule_end_time"
  | "samsclub_schedule_stop_on_oos"
  | "samsclub_schedule_status"
  | "samsclub_schedule_phase"
>;

export function useSamsclubSchedule(
  panelActive: boolean,
  status: SamsclubScheduleStatus | null,
  onRefresh?: () => Promise<void>,
) {
  const [enabled, setEnabled] = useState(() => status?.samsclub_schedule_enabled ?? false);
  const [startTime, setStartTime] = useState(() => status?.samsclub_schedule_start_time ?? "");
  const [endTime, setEndTime] = useState(() => status?.samsclub_schedule_end_time ?? "");
  const [stopOnOos, setStopOnOos] = useState(
    () => status?.samsclub_schedule_stop_on_oos ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scheduleStatus = useLiveScheduleStatus({
    enabled,
    phase: status?.samsclub_schedule_phase ?? "off",
    startTime: status?.samsclub_schedule_start_time ?? null,
    endTime: status?.samsclub_schedule_end_time ?? null,
    serverStatus: status?.samsclub_schedule_status ?? "",
  });

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setEnabled(response.status.samsclub_schedule_enabled);
      setStartTime(response.status.samsclub_schedule_start_time ?? "");
      setEndTime(response.status.samsclub_schedule_end_time ?? "");
      setStopOnOos(response.status.samsclub_schedule_stop_on_oos);
    }
  }, []);

  useEffect(() => {
    if (!panelActive || status == null || saving) {
      return;
    }
    setEnabled(status.samsclub_schedule_enabled);
    setStartTime(status.samsclub_schedule_start_time ?? "");
    setEndTime(status.samsclub_schedule_end_time ?? "");
    setStopOnOos(status.samsclub_schedule_stop_on_oos);
  }, [panelActive, status, saving]);

  const save = useCallback(
    async (patch: {
      enabled?: boolean;
      start_time?: string;
      end_time?: string;
      stop_on_oos?: boolean;
    }) => {
      setSaving(true);
      setSaveError(null);
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_SAMSCLUB_SCHEDULE",
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

  const handleStopOnOosChange = useCallback(
    (next: boolean) => {
      setStopOnOos(next);
      void save({ stop_on_oos: next });
    },
    [save],
  );

  return {
    enabled,
    startTime,
    endTime,
    stopOnOos,
    scheduleStatus,
    saving,
    saveError,
    handleEnabledChange,
    commitStartTime,
    commitEndTime,
    handleStopOnOosChange,
  };
}
