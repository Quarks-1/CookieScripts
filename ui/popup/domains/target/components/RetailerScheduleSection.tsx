import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { ScheduleTimeField } from "@shared/components/ScheduleTimeField.tsx";

interface RetailerScheduleSectionProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  stopOnOos: boolean;
  closeTabOnOos: boolean;
  scheduleStatus: string;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeCommit: (time: string) => void;
  onEndTimeCommit: (time: string) => void;
  onStopOnOosChange: (enabled: boolean) => void;
  onCloseTabOnOosChange: (enabled: boolean) => void;
}

export function RetailerScheduleSection({
  enabled,
  startTime,
  endTime,
  stopOnOos,
  closeTabOnOos,
  scheduleStatus,
  disabled,
  saving,
  saveError,
  onEnabledChange,
  onStartTimeCommit,
  onEndTimeCommit,
  onStopOnOosChange,
  onCloseTabOnOosChange,
}: RetailerScheduleSectionProps) {
  const controlsDisabled = disabled || saving;
  const headerStatus = saving ? "Saving schedule…" : scheduleStatus;

  return (
    <section aria-labelledby="retailer-schedule-heading" className="mt-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="retailer-schedule-heading" className="shrink-0 text-sm font-medium text-zinc-400">
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
        id="popup-retailer-schedule-enabled"
        label="Schedule auto start"
        checked={enabled}
        disabled={controlsDisabled}
        onChange={onEnabledChange}
      />

      <ScheduleTimeField
        id="popup-retailer-schedule-start"
        label="Start time"
        value={startTime}
        disabled={controlsDisabled}
        onCommit={onStartTimeCommit}
      />

      <ScheduleTimeField
        id="popup-retailer-schedule-end"
        label="End time (optional)"
        value={endTime}
        disabled={controlsDisabled}
        optional
        onCommit={onEndTimeCommit}
      />

      <EnableSlider
        id="popup-retailer-stop-on-oos"
        label="Stop on out of stock"
        checked={stopOnOos}
        disabled={controlsDisabled}
        onChange={onStopOnOosChange}
      />

      <EnableSlider
        id="popup-retailer-close-tab-on-oos"
        label="Close tab on out of stock"
        checked={closeTabOnOos}
        disabled={controlsDisabled}
        onChange={onCloseTabOnOosChange}
      />

      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
