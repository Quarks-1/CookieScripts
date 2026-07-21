import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { ScheduleTimeField } from "@shared/components/ScheduleTimeField.tsx";

interface SamsclubScheduleSectionProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  stopOnOos: boolean;
  scheduleStatus: string;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeCommit: (time: string) => void;
  onEndTimeCommit: (time: string) => void;
  onStopOnOosChange: (enabled: boolean) => void;
}

export function SamsclubScheduleSection({
  enabled,
  startTime,
  endTime,
  stopOnOos,
  scheduleStatus,
  disabled,
  saving,
  saveError,
  onEnabledChange,
  onStartTimeCommit,
  onEndTimeCommit,
  onStopOnOosChange,
}: SamsclubScheduleSectionProps) {
  const controlsDisabled = disabled || saving;
  const headerStatus = saving ? "Saving schedule…" : scheduleStatus;

  return (
    <section aria-labelledby="samsclub-schedule-heading" className="mt-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="samsclub-schedule-heading" className="shrink-0 text-sm font-medium text-zinc-400">
          Schedule
        </h2>
        {headerStatus && (
          <p
            role="status"
            aria-live="polite"
            className="min-w-0 truncate text-right text-xs text-zinc-500"
          >
            {headerStatus}
          </p>
        )}
      </div>

      <EnableSlider
        id="popup-samsclub-schedule-enabled"
        label="Schedule auto start"
        checked={enabled}
        disabled={controlsDisabled}
        onChange={onEnabledChange}
      />

      <ScheduleTimeField
        id="popup-samsclub-schedule-start"
        label="Start time"
        value={startTime}
        disabled={controlsDisabled}
        onCommit={onStartTimeCommit}
      />

      <ScheduleTimeField
        id="popup-samsclub-schedule-end"
        label="End time (optional)"
        value={endTime}
        disabled={controlsDisabled}
        optional
        onCommit={onEndTimeCommit}
      />

      <EnableSlider
        id="popup-samsclub-stop-on-oos"
        label="Stop on out of stock"
        checked={stopOnOos}
        disabled={controlsDisabled}
        onChange={onStopOnOosChange}
      />

      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
