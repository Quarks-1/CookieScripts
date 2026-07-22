import { useEffect, useState } from "react";

import {
  schedulePhaseStatusLine,
  type SchedulePhase,
} from "@ext/core/lib/schedule.ts";

type LiveScheduleStatusInput = {
  enabled: boolean;
  phase: SchedulePhase;
  startTime: string | null;
  endTime?: string | null;
  serverStatus: string;
};

function isScheduleActionStatus(serverStatus: string): boolean {
  return serverStatus !== "" && !serverStatus.startsWith("Starts in");
}

export function useLiveScheduleStatus({
  enabled,
  phase,
  startTime,
  endTime,
  serverStatus,
}: LiveScheduleStatusInput): string {
  const [liveStatus, setLiveStatus] = useState(serverStatus);

  useEffect(() => {
    if (!enabled || phase === "off") {
      setLiveStatus("");
      return;
    }
    setLiveStatus(serverStatus);
  }, [enabled, phase, serverStatus]);

  useEffect(() => {
    if (!enabled || phase === "off" || phase !== "pending" || isScheduleActionStatus(serverStatus)) {
      return;
    }

    const tick = (): void => {
      setLiveStatus(schedulePhaseStatusLine("pending", startTime, new Date(), undefined, endTime));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [enabled, endTime, phase, serverStatus, startTime]);

  return liveStatus;
}
