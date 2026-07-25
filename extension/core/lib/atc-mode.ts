export type AtcMode = "off" | "frontend" | "backend" | "both";

export const ATC_MODE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "both", label: "Both" },
] as const satisfies readonly { value: AtcMode; label: string }[];

export function atcModeFromBooleans(frontend: boolean, backend: boolean): AtcMode {
  if (frontend && backend) {
    return "both";
  }
  if (frontend) {
    return "frontend";
  }
  if (backend) {
    return "backend";
  }
  return "off";
}

export function booleansFromAtcMode(mode: AtcMode): { frontend: boolean; backend: boolean } {
  switch (mode) {
    case "off":
      return { frontend: false, backend: false };
    case "frontend":
      return { frontend: true, backend: false };
    case "backend":
      return { frontend: false, backend: true };
    case "both":
      return { frontend: true, backend: true };
  }
}

export function isAtcEnabled(frontend: boolean, backend: boolean): boolean {
  return atcModeFromBooleans(frontend, backend) !== "off";
}
