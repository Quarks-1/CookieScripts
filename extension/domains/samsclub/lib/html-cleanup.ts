import { SAMSCLUB_PROBE_BRIDGE_ID } from "@ext/domains/samsclub/lib/constants.ts";

export function stripExtensionArtifacts(html: string): string {
  const probePattern = new RegExp(
    `<script[^>]*id="${SAMSCLUB_PROBE_BRIDGE_ID}"[^>]*>\\s*</script>`,
    "gi",
  );
  return html.replace(probePattern, "");
}
