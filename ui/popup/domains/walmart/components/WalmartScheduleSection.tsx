import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { ScheduleTimeField } from "@shared/components/ScheduleTimeField.tsx";

interface WalmartScheduleSectionProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  scheduleStatus: string;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeCommit: (time: string) => void;
  onEndTimeCommit: (time: string) => void;
}

export function WalmartScheduleSection({
  enabled,
  startTime,
  endTime,
  scheduleStatus,
  disabled,
  saving,
  saveError,
  onEnabledChange,
  onStartTimeCommit,
  onEndTimeCommit,
}: WalmartScheduleSectionProps) {
  const controlsDisabled = disabled || saving;
  const headerStatus = saving ? "Saving schedule…" : scheduleStatus;

  return (
    <section aria-labelledby="walmart-schedule-heading" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="walmart-schedule-heading" className="shrink-0 text-sm font-medium text-zinc-400">
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
        id="popup-walmart-schedule-enabled"
        label="Schedule auto refresh"
        checked={enabled}
        disabled={controlsDisabled}
        onChange={onEnabledChange}
      />

      <ScheduleTimeField
        id="popup-walmart-schedule-start"
        label="Start time"
        value={startTime}
        disabled={controlsDisabled}
        onCommit={onStartTimeCommit}
      />

      <ScheduleTimeField
        id="popup-walmart-schedule-end"
        label="End time (optional)"
        value={endTime}
        disabled={controlsDisabled}
        optional
        onCommit={onEndTimeCommit}
      />

      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
