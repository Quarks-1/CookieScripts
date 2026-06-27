import type { FormEvent } from "react";

import type { ChannelTargetDraft } from "@shared/lib/channelTargetDrafts.ts";
import { DomainPills } from "./DomainPills.tsx";

export interface WatchTargetsFormProps {
  drafts: ChannelTargetDraft[];
  disabled: boolean;
  targetError: string | null;
  targetSuccess: string | null;
  savingTarget: boolean;
  onUpdateDraft: (
    key: string,
    updater: (draft: ChannelTargetDraft) => ChannelTargetDraft,
  ) => void;
  onAddChannel: () => void;
  onRemoveChannel: (key: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

export function WatchTargetsForm({
  drafts,
  disabled,
  targetError,
  targetSuccess,
  savingTarget,
  onUpdateDraft,
  onAddChannel,
  onRemoveChannel,
  onSubmit,
}: WatchTargetsFormProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 id="watch-targets-heading" className="text-lg font-semibold">
        Watch targets
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Map each Discord channel to its own allowed domains.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" aria-labelledby="watch-targets-heading">
        <div className="space-y-4">
          {drafts.map((draft, index) => {
            const channelInputId = `channel-id-${draft.key}`;
            const domainInputId = `domain-input-${draft.key}`;
            return (
              <div key={draft.key} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-300">Channel {index + 1}</p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveChannel(draft.key)}
                    className="text-xs text-zinc-500 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <label htmlFor={channelInputId} className="mt-3 block text-sm">
                  <span className="text-zinc-400">Channel ID</span>
                  <input
                    id={channelInputId}
                    type="text"
                    inputMode="numeric"
                    pattern="\d+"
                    value={draft.channel_id}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdateDraft(draft.key, (current) => ({
                        ...current,
                        channel_id: event.target.value,
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-zinc-300 invalid:user-invalid:border-red-600 disabled:opacity-50"
                    required
                  />
                </label>

                <div className="mt-3 text-sm">
                  <span className="text-zinc-400" id={`${domainInputId}-label`}>
                    Allowed domains
                  </span>
                  <div className="mt-2" aria-labelledby={`${domainInputId}-label`}>
                    <DomainPills
                      inputId={domainInputId}
                      pills={draft.pills}
                      disabled={disabled}
                      onChange={(next) => {
                        onUpdateDraft(draft.key, (current) => ({
                          ...current,
                          pills: next,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onAddChannel}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add channel
        </button>

        {targetError && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200"
          >
            {targetError}
          </p>
        )}
        {targetSuccess && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200"
          >
            {targetSuccess}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled || savingTarget}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingTarget ? "Saving…" : "Save watch targets"}
        </button>
      </form>
    </section>
  );
}
