#!/usr/bin/env node
/**
 * Local checkout debug log sink for Sam's Club automation.
 *
 * Usage:
 *   npm run debug:samsclub-checkout
 *
 * Then reload the extension, reproduce checkout, and read:
 *   .debug/samsclub-checkout.log
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 9876;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const debugDir = path.join(root, ".debug");
const logFile = path.join(debugDir, "samsclub-checkout.log");

fs.mkdirSync(debugDir, { recursive: true });

function appendLine(line) {
  fs.appendFileSync(logFile, `${line}\n`);
}

async function isServerHealthy() {
  try {
    const response = await fetch(HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

function startServer() {
  fs.appendFileSync(
    logFile,
    `\n--- samsclub checkout debug started ${new Date().toISOString()} ---\n`,
  );

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/log") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const entry = JSON.parse(body);
          const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
          appendLine(`${entry.ts} [${entry.scope}] ${entry.message}${data}`);
        } catch {
          appendLine(`${new Date().toISOString()} [raw] ${body}`);
        }
        res.writeHead(204);
        res.end();
      });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on("error", (err) => {
    if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
      console.log(`Sam's Club checkout debug server already running on http://127.0.0.1:${PORT}`);
      console.log(`Log file: ${logFile}`);
      process.exit(0);
    }
    throw err;
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Sam's Club checkout debug server listening on http://127.0.0.1:${PORT}`);
    console.log(`Writing log to ${logFile}`);
  });
}

const healthy = await isServerHealthy();
if (healthy) {
  console.log(`Sam's Club checkout debug server already running on http://127.0.0.1:${PORT}`);
  console.log(`Log file: ${logFile}`);
  process.exit(0);
}

startServer();
