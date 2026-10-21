import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const entryUrl = new URL("../src/index.js", import.meta.url);
const HUB_ORIGIN = "https://tamalab-hub.pages.dev";
const APP_ORIGIN = "https://tamalab-sock-pair.pages.dev";
const APP_IDS = [
  "sock-pair",
  "chimo",
  "ballrace",
  "mogumon",
  "treasure",
  "fossil-excavation",
  "math-marathon",
  "quiz-zukan",
  "sentinel-blacklist",
  "shatepon",
  "triad-io",
];

async function createWorker() {
  assert.ok(existsSync(fileURLToPath(entryUrl)), "metrics Worker entry must exist");
  const { default: worker, PageViewCounter } = await import(entryUrl.href);
  const storageByAppId = new Map();
  const instances = new Map();
  const namespace = {
    idFromName(name) {
      return { name };
    },
    get(id) {
      if (!instances.has(id.name)) {
        const rows = new Map();
        storageByAppId.set(id.name, rows);
        const sql = {
          exec(statement, ...parameters) {
            const query = statement.replace(/\s+/g, " ").trim().toUpperCase();
            if (query.startsWith("CREATE TABLE")) {
              return { toArray: () => [] };
            }
            if (query.startsWith("INSERT INTO PAGE_VIEWS")) {
              const [appId] = parameters;
              rows.set(appId, (rows.get(appId) ?? 0) + 1);
              return { toArray: () => [{ total: rows.get(appId) }] };
            }
            if (query.startsWith("SELECT TOTAL FROM PAGE_VIEWS")) {
              const [appId] = parameters;
              const total = rows.get(appId);
              return { toArray: () => total === undefined ? [] : [{ total }] };
            }
            throw new Error("Unexpected SQL: " + query);
          },
        };
        const durableObject = new PageViewCounter({ storage: { sql } });
        instances.set(id.name, {
          fetch: (input, init) => {
            const request = input instanceof Request ? input : new Request(input, init);
            return durableObject.fetch(request);
          },
        });
      }
      return instances.get(id.name);
    },
  };
  return {
    worker,
    env: { PAGE_VIEWS: namespace },
    storageByAppId,
  };
}

function postPageView(origin, body) {
  return new Request("https://metrics.example/api/page-view", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body,
  });
}

test("servesOneClientForKnownApp", async () => {
  const { worker, env } = await createWorker();
  const response = await worker.fetch(
    new Request("https://metrics.example/client.js?app=sock-pair"),
    env,
  );
  const source = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.match(source, /sock-pair/);
  assert.match(source, /credentials:\s*["']omit["']/);
  assert.match(source, /keepalive:\s*true/);
});

test("clientIgnoresPostFailure", async () => {
  const { worker, env } = await createWorker();
  const response = await worker.fetch(
    new Request("https://metrics.example/client.js?app=sock-pair"),
    env,
  );
  const source = await response.text();
  const calls = [];

  vm.runInNewContext(source, {
    fetch: (...args) => {
      calls.push(args);
      return Promise.reject(new Error("network unavailable"));
    },
  });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /\/api\/page-view$/);
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].keepalive, true);
});

test("incrementsKnownAppFromAllowedOrigin", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  const response = await worker.fetch(
    postPageView(APP_ORIGIN, JSON.stringify({ appId: "sock-pair" })),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), APP_ORIGIN);
  assert.equal(storageByAppId.get("sock-pair").get("sock-pair"), 1);
});

test("rejectsMalformedJsonWithoutWriting", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  const response = await worker.fetch(postPageView(APP_ORIGIN, "{"), env);

  assert.equal(response.status, 400);
  assert.equal(storageByAppId.size, 0);
});

test("rejectsUnknownAppIdWithoutWriting", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  const response = await worker.fetch(
    postPageView(APP_ORIGIN, JSON.stringify({ appId: "not-in-catalog" })),
    env,
  );

  assert.equal(response.status, 400);
  assert.equal(storageByAppId.size, 0);
});

test("rejectsDisallowedOrigin", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  const response = await worker.fetch(
    postPageView("https://attacker.example", JSON.stringify({ appId: "sock-pair" })),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(storageByAppId.size, 0);
});

test("answersAllowedPreflightWithoutCounting", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  const response = await worker.fetch(new Request("https://metrics.example/api/page-view", {
    method: "OPTIONS",
    headers: {
      Origin: APP_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), APP_ORIGIN);
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.equal(storageByAppId.size, 0);
});

test("returnsAllTotalsWithZeroDefaults", async () => {
  const { worker, env, storageByAppId } = await createWorker();
  await worker.fetch(
    postPageView(APP_ORIGIN, JSON.stringify({ appId: "sock-pair" })),
    env,
  );
  const response = await worker.fetch(new Request("https://metrics.example/api/page-views", {
    headers: { Origin: HUB_ORIGIN },
  }), env);
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), HUB_ORIGIN);
  assert.deepEqual(Object.keys(result.counts).sort(), [...APP_IDS].sort());
  assert.equal(result.counts["sock-pair"], 1);
  assert.equal(result.counts.chimo, 0);
  assert.equal([...storageByAppId.values()].filter(rows => rows.size > 0).length, 1);
  assert.deepEqual([...storageByAppId.get("sock-pair").entries()], [["sock-pair", 1]]);
});
