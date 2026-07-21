import type { ScheduleRetailer } from "@ext/core/lib/schedule.ts";

const scheduleActionStatus = new Map<ScheduleRetailer, string>();

export function setScheduleActionStatus(retailer: ScheduleRetailer, status: string): void {
  if (status.trim() === "") {
    scheduleActionStatus.delete(retailer);
    return;
  }
  scheduleActionStatus.set(retailer, status);
}

export function getScheduleActionStatus(retailer: ScheduleRetailer): string {
  return scheduleActionStatus.get(retailer) ?? "";
}

export function clearScheduleActionStatus(retailer: ScheduleRetailer): void {
  scheduleActionStatus.delete(retailer);
}

export function clearAllScheduleActionStatus(): void {
  scheduleActionStatus.clear();
}
