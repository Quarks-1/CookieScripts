import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root (three levels up from lib/). */
export const REPO_ROOT = join(__dirname, "../../..");

export const CATALOG_PATH = "extension/core/data/catalog.json";
export const REPORT_PATH = "research/catalog-liveness-report.json";
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Resolve a repo-relative path to an absolute path. */
export function resolveFromRoot(relativePath) {
  return join(REPO_ROOT, relativePath);
}
