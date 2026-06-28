export type ManualUiCallbacks = {
  onStartAuto: () => void;
  onStopAuto: () => void;
  onRefreshIntervalChange: (intervalSec: number) => void;
  onToggleRecord: () => void;
  onSaveRecording: () => void;
  onClearRecording: () => void;
};

let panelRoot: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let refreshInput: HTMLInputElement | null = null;
let recording = false;

export function setManualUiStatus(text: string): void {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

export function getManualUiRefreshInterval(): number {
  if (!refreshInput) {
    return 0;
  }
  const value = Number.parseInt(refreshInput.value, 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function commitRefreshInterval(callbacks: ManualUiCallbacks): void {
  callbacks.onRefreshIntervalChange(getManualUiRefreshInterval());
}

export function setManualUiRefreshInterval(sec: number): void {
  if (refreshInput) {
    refreshInput.value = String(sec);
  }
}

export function isManualUiMounted(): boolean {
  return panelRoot !== null;
}

export function mountManualUi(callbacks: ManualUiCallbacks, refreshIntervalSec = 0): void {
  if (panelRoot) {
    return;
  }

  panelRoot = document.createElement("div");
  panelRoot.id = "cookiescripts-retailer-panel";
  panelRoot.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#18181b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:8px;padding:12px;min-width:240px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)";

  const title = document.createElement("div");
  title.textContent = "CookieScripts Target Auto";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  panelRoot.appendChild(title);

  statusEl = document.createElement("div");
  statusEl.textContent = "Idle";
  statusEl.style.marginBottom = "8px";
  statusEl.style.color = "#a1a1aa";
  panelRoot.appendChild(statusEl);

  const refreshLabel = document.createElement("label");
  refreshLabel.textContent = "Hard refresh interval (sec, 0=off)";
  refreshLabel.style.cssText = "display:block;margin-top:4px;font-size:11px;color:#a1a1aa";
  refreshLabel.htmlFor = "cookiescripts-retailer-refresh-interval";
  panelRoot.appendChild(refreshLabel);

  refreshInput = document.createElement("input");
  refreshInput.id = "cookiescripts-retailer-refresh-interval";
  refreshInput.type = "number";
  refreshInput.min = "0";
  refreshInput.max = "3600";
  refreshInput.step = "1";
  refreshInput.value = String(refreshIntervalSec);
  refreshInput.style.cssText =
    "display:block;width:100%;margin-top:4px;margin-bottom:4px;padding:6px 8px;border:1px solid #52525b;border-radius:6px;background:#27272a;color:#f4f4f5;box-sizing:border-box";
  refreshInput.addEventListener("input", () => commitRefreshInterval(callbacks));
  refreshInput.addEventListener("change", () => commitRefreshInterval(callbacks));
  panelRoot.appendChild(refreshInput);

  const refreshHint = document.createElement("div");
  refreshHint.textContent = "Reloads while main Add to cart is disabled.";
  refreshHint.style.cssText = "margin-bottom:8px;font-size:10px;color:#71717a";
  panelRoot.appendChild(refreshHint);

  const buttonRow = (label: string, onClick: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText =
      "display:block;width:100%;margin-top:6px;padding:6px 8px;border:1px solid #52525b;border-radius:6px;background:#27272a;color:#f4f4f5;cursor:pointer";
    button.addEventListener("click", onClick);
    panelRoot!.appendChild(button);
    return button;
  };

  buttonRow("Start Auto Mode", callbacks.onStartAuto);
  buttonRow("Stop Auto Mode", callbacks.onStopAuto);

  const recordButton = buttonRow("Record", () => {
    recording = !recording;
    recordButton.textContent = recording ? "Stop Record" : "Record";
    callbacks.onToggleRecord();
  });

  buttonRow("Save Recording", callbacks.onSaveRecording);
  buttonRow("Clear Recording", callbacks.onClearRecording);

  document.body.appendChild(panelRoot);
}

export function unmountManualUi(): void {
  panelRoot?.remove();
  panelRoot = null;
  statusEl = null;
  refreshInput = null;
  recording = false;
}

export function isRecording(): boolean {
  return recording;
}
