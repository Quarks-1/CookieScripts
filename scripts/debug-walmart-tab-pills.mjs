#!/usr/bin/env node
/**
 * Launches Chrome with the built extension and logs active-tab resolution
 * for duplicate walmart.com tabs. Run: node scripts/debug-walmart-tab-pills.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "cookiescripts-debug-"));

if (!fs.existsSync(path.join(distPath, "manifest.json"))) {
  console.error("Missing dist/. Run npm run build first.");
  process.exit(1);
}

const chromePaths =
  process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      ]
    : process.platform === "win32"
      ? [
          path.join(
            process.env.PROGRAMFILES ?? "C:\\Program Files",
            "Google/Chrome/Application/chrome.exe",
          ),
        ]
      : ["google-chrome", "chromium-browser", "chromium"];

const chromeBin = chromePaths.find((candidate) => fs.existsSync(candidate) ?? false);
if (!chromeBin) {
  console.error("Chrome not found. Install Google Chrome to run this debug script.");
  process.exit(1);
}

const walmartUrl =
  "https://www.walmart.com/ip/pokemon-tcg-mega-evolution-ascended-heroes-mega-ex-box/1234567890";

const args = [
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${distPath}`,
  `--load-extension=${distPath}`,
  "--no-first-run",
  "--no-default-browser-check",
  walmartUrl,
  walmartUrl,
  walmartUrl,
];

console.log("Launching Chrome with extension:", distPath);
console.log("Profile dir:", profileDir);
console.log("Open the CookieScripts side panel, switch between the 3 walmart tabs,");
console.log("and confirm pill highlights follow the active tab.");

const child = spawn(chromeBin, args, { stdio: "inherit" });

child.on("exit", (code) => {
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
  process.exit(code ?? 0);
});
