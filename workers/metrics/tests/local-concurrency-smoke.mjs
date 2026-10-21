import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(workerRoot, "..", "..", "..");
const configPath = path.join(workerRoot, "wrangler.jsonc");
const npxCliPath = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const hubOrigin = "https://tamalab.hub-6r8.pages.dev";
const appOrigin = "https://tamalab.sock-pair.pages.dev";

assert.ok(existsSync(configPath), "metrics Worker config must exist");
assert.ok(existsSync(npxCliPath), "npm's npx CLI must exist beside Node.js");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const port = await findFreePort();
const persistPath = await mkdtemp(path.join(os.tmpdir(), "tama-metrics-"));
const baseUrl = "http://127.0.0.1:" + port;
const child = spawn(process.execPath, [
  npxCliPath,
  "wrangler@4.151.1",
  "dev",
  "--local",
  "--ip",
  "127.0.0.1",
  "--port",
  String(port),
  "--persist-to",
  persistPath,
  "--config",
  configPath,
], {
  cwd: repoRoot,
  env: { ...process.env, CI: "1" },
  detached: process.platform !== "win32",
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let childExit = null;
child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
child.stderr.setEncoding("utf8").on("data", chunk => { output += chunk; });
child.once("exit", (code, signal) => { childExit = { code, signal }; });

async function stopWorker() {
  if (childExit) return;

  const exited = new Promise(resolve => child.once("exit", resolve));
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    await new Promise(resolve => {
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      return;
    }
  }

  const stopped = await Promise.race([
    exited.then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!stopped && process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The process may have exited between the timeout and the kill.
    }
  }
}

try {
  let ready = false;
  let lastError;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !ready) {
    if (childExit) {
      throw new Error("Wrangler exited before ready (" + JSON.stringify(childExit) + "):\n" + output);
    }
    try {
      const response = await fetch(baseUrl + "/api/page-views", {
        headers: { Origin: hubOrigin },
        signal: AbortSignal.timeout(2_000),
      });
      ready = response.status === 200;
      if (!ready) lastError = new Error("Worker readiness returned " + response.status);
    } catch (error) {
      lastError = error;
    }
    if (!ready) await delay(300);
  }
  assert.ok(ready, "Wrangler did not become ready: " + lastError + "\n" + output);

  const requests = await Promise.all(Array.from({ length: 50 }, () => fetch(
    baseUrl + "/api/page-view",
    {
      method: "POST",
      headers: {
        Origin: appOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ appId: "sock-pair" }),
      signal: AbortSignal.timeout(10_000),
    },
  )));
  assert.ok(requests.every(response => response.status === 204));

  const response = await fetch(baseUrl + "/api/page-views", {
    headers: { Origin: hubOrigin },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.counts["sock-pair"], 50);
  console.log("Wrangler local concurrency smoke passed: 50 concurrent page views persisted.");
} finally {
  await stopWorker();
  await rm(persistPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
