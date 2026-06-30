import { WALMART_PROBE_BRIDGE_ID } from "@ext/domains/walmart/lib/constants.ts";

export function stripExtensionArtifacts(html: string): string {
  const probePattern = new RegExp(
    `<script[^>]*id="${WALMART_PROBE_BRIDGE_ID}"[^>]*>\\s*</script>`,
    "gi",
  );
  return html.replace(probePattern, "");
}
