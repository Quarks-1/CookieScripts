import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { LinkHistory } from "@shared/components/LinkHistory.tsx";
import { WatchStatusBadge } from "@shared/components/WatchStatusBadge.tsx";
import { ChannelDomainsSection } from "../../domains/discord/components/ChannelDomainsSection.tsx";
import { ChannelKeywordsSection } from "../../domains/discord/components/ChannelKeywordsSection.tsx";
import { ChannelSkuWatchSection } from "../../domains/discord/components/ChannelSkuWatchSection.tsx";
import { DetectedLinksSection } from "../../domains/discord/components/DetectedLinksSection.tsx";
import { useChannelDiscordSettings } from "../../domains/discord/hooks/useChannelDiscordSettings.ts";
import { useDetectedLinks } from "../../domains/discord/hooks/useDetectedLinks.ts";
import { useLinkHistory } from "../../domains/discord/hooks/useLinkHistory.ts";

interface DiscordPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
}

export function DiscordPanel({ status, disabled }: DiscordPanelProps) {
  const onDiscordChannel = status.active_tab_kind === "discord_channel";
  const channelId = onDiscordChannel ? status.active_channel_id : null;
  const channelActive = onDiscordChannel && status.enabled;

  const discordSettings = useChannelDiscordSettings(channelId, channelActive);
  const detectedLinks = useDetectedLinks(
    channelId,
    channelActive,
    discordSettings.domains,
    discordSettings.handleAcceptDomain,
  );
  const linkHistory = useLinkHistory();

  return (
    <div className="space-y-3">
      <section aria-label="Status">
        <WatchStatusBadge status={status} />
      </section>

      <ChannelKeywordsSection
        channelId={channelId}
        positiveKeywords={discordSettings.positiveKeywords}
        negativeKeywords={discordSettings.negativeKeywords}
        skuModeActive={status.sku_open_mode_enabled}
        disabled={discordSettings.disabled || disabled || !status.has_allowed_domains}
        saving={discordSettings.saving}
        saveError={discordSettings.saveError}
        onPositiveKeywordsChange={discordSettings.handlePositiveKeywordsChange}
        onNegativeKeywordsChange={discordSettings.handleNegativeKeywordsChange}
      />

      <ChannelSkuWatchSection
        channelId={channelId}
        targetSkus={discordSettings.targetSkus}
        disabled={discordSettings.disabled || disabled || !status.has_allowed_domains}
        saving={discordSettings.saving}
        saveError={discordSettings.saveError}
        onTargetSkusChange={discordSettings.handleTargetSkusChange}
      />

      <ChannelDomainsSection
        channelId={channelId}
        domains={discordSettings.domains}
        disabled={discordSettings.disabled || disabled}
        saving={discordSettings.saving}
        saveError={discordSettings.saveError}
        onDomainsChange={discordSettings.handleDomainsChange}
      />

      <DetectedLinksSection
        domains={detectedLinks.domains}
        loading={detectedLinks.loading}
        acting={detectedLinks.acting}
        error={detectedLinks.error}
        disabled={detectedLinks.disabled || disabled}
        onAccept={(domain) => void detectedLinks.handleAccept(domain)}
        onDismiss={(domain) => void detectedLinks.handleDismiss(domain)}
        onRefresh={() => void detectedLinks.refresh()}
      />

      <section aria-labelledby="link-history-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="link-history-heading" className="text-sm font-medium text-zinc-400">
            Link history
          </h2>
          <button
            type="button"
            disabled={linkHistory.clearing || linkHistory.history.length === 0}
            onClick={() => void linkHistory.handleClearHistory()}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
          >
            {linkHistory.clearing ? "Clearing…" : "Clear"}
          </button>
        </div>
        <div className="mt-2 max-h-48 overflow-y-auto">
          {linkHistory.loading ? (
            <p className="text-sm text-zinc-500">Loading history…</p>
          ) : (
            <LinkHistory
              items={linkHistory.history}
              variant="compact"
              emptyMessage="No links opened yet."
            />
          )}
        </div>
        {linkHistory.clearMessage && (
          <p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-500">
            {linkHistory.clearMessage}
          </p>
        )}
      </section>
    </div>
  );
}
