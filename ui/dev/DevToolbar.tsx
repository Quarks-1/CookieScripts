import {
  addSampleHistoryItem,
  resetMockStore,
  seedEmptySettings,
  setPopupScenario,
  type PopupScenario,
} from "./mock-store.ts";
import { POPUP_SCENARIO_LABELS } from "./chrome-mock.ts";

interface DevToolbarProps {
  surface: "popup" | "options";
}

export function DevToolbar({ surface }: DevToolbarProps) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-800/60 bg-amber-950/95 px-4 py-3 text-xs text-amber-100 shadow-lg backdrop-blur"
      aria-label="Dev preview controls"
    >
      <p className="font-medium text-amber-200">
        Dev preview — mock chrome APIs (not the real extension)
      </p>

      {surface === "popup" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-amber-300/80">Popup scenario:</span>
          {(Object.keys(POPUP_SCENARIO_LABELS) as PopupScenario[]).map((scenario) => (
            <button
              key={scenario}
              type="button"
              onClick={() => setPopupScenario(scenario)}
              className="rounded border border-amber-700/80 px-2 py-1 hover:bg-amber-900"
            >
              {POPUP_SCENARIO_LABELS[scenario]}
            </button>
          ))}
        </div>
      )}

      {surface === "options" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => resetMockStore()}
            className="rounded border border-amber-700/80 px-2 py-1 hover:bg-amber-900"
          >
            Reset sample data
          </button>
          <button
            type="button"
            onClick={() => seedEmptySettings()}
            className="rounded border border-amber-700/80 px-2 py-1 hover:bg-amber-900"
          >
            Empty settings
          </button>
          <button
            type="button"
            onClick={() => addSampleHistoryItem()}
            className="rounded border border-amber-700/80 px-2 py-1 hover:bg-amber-900"
          >
            Add history item
          </button>
        </div>
      )}

      <p className="mt-2 text-amber-300/70">
        {surface === "popup" ? (
          <>
            <a href="/ui/dev/options.html" className="underline">
              Open options preview
            </a>
            {" · "}
            Changes persist in memory until you refresh the page.
          </>
        ) : (
          <>
            <a href="/ui/dev/popup.html" className="underline">
              Open popup preview
            </a>
            {" · "}
            Save/clear updates the in-memory mock store.
          </>
        )}
      </p>
    </aside>
  );
}
