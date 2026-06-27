import {
  addStorageChangedListener,
  getPopupScenario,
  handleUiMessage,
  removeStorageChangedListener,
  type PopupScenario,
} from "./mock-store.ts";

type TabListener = (info: chrome.tabs.TabActiveInfo) => void;
type TabUpdatedListener = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
) => void;

const tabActivatedListeners = new Set<TabListener>();
const tabUpdatedListeners = new Set<TabUpdatedListener>();

export function installChromeMock() {
  if (globalThis.chrome?.runtime?.id === "dev-preview") {
    return;
  }

  const chromeMock = {
    runtime: {
      id: "dev-preview",
      sendMessage(message: unknown) {
        return Promise.resolve(handleUiMessage(message as Parameters<typeof handleUiMessage>[0]));
      },
    },
    storage: {
      onChanged: {
        addListener(listener: Parameters<typeof addStorageChangedListener>[0]) {
          addStorageChangedListener(listener);
        },
        removeListener(listener: Parameters<typeof removeStorageChangedListener>[0]) {
          removeStorageChangedListener(listener);
        },
      },
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
    },
    tabs: {
      onActivated: {
        addListener(listener: TabListener) {
          tabActivatedListeners.add(listener);
        },
        removeListener(listener: TabListener) {
          tabActivatedListeners.delete(listener);
        },
      },
      onUpdated: {
        addListener(listener: TabUpdatedListener) {
          tabUpdatedListeners.add(listener);
        },
        removeListener(listener: TabUpdatedListener) {
          tabUpdatedListeners.delete(listener);
        },
      },
    },
  };

  globalThis.chrome = chromeMock as unknown as typeof chrome;
}

export const POPUP_SCENARIO_LABELS: Record<PopupScenario, string> = {
  watching: "Watching channel",
  active_no_domains: "Active, no domains",
  no_discord: "No Discord tab",
};

export function currentScenarioLabel() {
  return POPUP_SCENARIO_LABELS[getPopupScenario()];
}
