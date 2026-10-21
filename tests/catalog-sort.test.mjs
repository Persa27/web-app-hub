import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const moduleUrl = new URL("../catalog-sort.js", import.meta.url);
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
  "triad-io",
];

async function loadSortModule() {
  assert.ok(existsSync(fileURLToPath(moduleUrl)), "catalog-sort.js must exist");
  return import(moduleUrl.href);
}

function app(id, uploadedAt, updatedAt) {
  return { id, uploadedAt, updatedAt };
}

test("sortsEachFieldInBothDirections", async () => {
  const { sortApps } = await loadSortModule();
  const apps = [
    app("a", "2024-01-10", "2024-02-10"),
    app("b", "2025-03-01", "2023-04-01"),
    app("c", "2023-04-01", "2025-05-01"),
    app("d", "2024-08-01", "2024-01-01"),
  ];
  const pageViews = { a: 5, b: 1, c: 8, d: 3 };

  assert.deepEqual(sortApps(apps, "featured", pageViews).map(item => item.id), ["a", "b", "c", "d"]);
  assert.deepEqual(sortApps(apps, "uploaded-desc", pageViews).map(item => item.id), ["b", "d", "a", "c"]);
  assert.deepEqual(sortApps(apps, "uploaded-asc", pageViews).map(item => item.id), ["c", "a", "d", "b"]);
  assert.deepEqual(sortApps(apps, "updated-desc", pageViews).map(item => item.id), ["c", "a", "d", "b"]);
  assert.deepEqual(sortApps(apps, "updated-asc", pageViews).map(item => item.id), ["b", "d", "a", "c"]);
  assert.deepEqual(sortApps(apps, "views-desc", pageViews).map(item => item.id), ["c", "a", "d", "b"]);
  assert.deepEqual(sortApps(apps, "views-asc", pageViews).map(item => item.id), ["b", "d", "a", "c"]);
  assert.deepEqual(apps.map(item => item.id), ["a", "b", "c", "d"]);
});

test("keepsCatalogOrderForTies", async () => {
  const { sortApps } = await loadSortModule();
  const apps = [
    app("first", "2024-01-01", "2024-01-01"),
    app("second", "2024-01-01", "2024-01-01"),
    app("third", "2024-01-01", "2024-01-01"),
  ];
  const pageViews = { first: 10, second: 10, third: 10 };

  for (const mode of ["uploaded-desc", "uploaded-asc", "updated-desc", "updated-asc", "views-desc", "views-asc"]) {
    assert.deepEqual(sortApps(apps, mode, pageViews).map(item => item.id), ["first", "second", "third"]);
  }
});

test("placesMissingValuesLast", async () => {
  const { sortApps } = await loadSortModule();
  const apps = [
    { id: "missing-date", updatedAt: "2024-01-01" },
    { id: "known-date", uploadedAt: "2023-01-01", updatedAt: "2025-01-01" },
    { id: "missing-count", uploadedAt: "2025-01-01", updatedAt: "2023-01-01" },
    { id: "zero-count", uploadedAt: "2024-01-01", updatedAt: "2024-01-01" },
  ];
  const pageViews = { "missing-date": 4, "known-date": 0, "zero-count": 0 };

  assert.deepEqual(sortApps(apps, "uploaded-asc", pageViews).map(item => item.id), [
    "known-date", "zero-count", "missing-count", "missing-date",
  ]);
  assert.deepEqual(sortApps(apps, "updated-desc", pageViews).map(item => item.id), [
    "known-date", "missing-date", "zero-count", "missing-count",
  ]);
  assert.deepEqual(sortApps(apps, "views-desc", pageViews).map(item => item.id), [
    "missing-date", "known-date", "zero-count", "missing-count",
  ]);
  assert.deepEqual(sortApps(apps, "views-asc", pageViews).map(item => item.id), [
    "known-date", "zero-count", "missing-date", "missing-count",
  ]);
});

test("formatsDateAndMissingDate", async () => {
  const { formatDate } = await loadSortModule();

  assert.equal(formatDate("2026-10-21"), "2026/10/21");
  assert.equal(formatDate("2024-02-29"), "2024/02/29");
  assert.equal(formatDate(undefined), "—");
  assert.equal(formatDate(""), "—");
  assert.equal(formatDate("2025-02-29"), "—");
  assert.equal(formatDate("2026/10/21"), "—");
});

test("formatsPageViewCounts", async () => {
  const { formatPageViews } = await loadSortModule();

  assert.equal(formatPageViews(0), "0");
  assert.equal(formatPageViews(1234), "1,234");
  assert.equal(formatPageViews(null), "—");
  assert.equal(formatPageViews(undefined), "—");
});

test("keepsCountsUnavailableOnFetchFailure", async () => {
  const { loadPageViews } = await loadSortModule();

  assert.equal(await loadPageViews("https://metrics.example/api/page-views", async () => {
    throw new Error("network unavailable");
  }), null);
  assert.equal(await loadPageViews("https://metrics.example/api/page-views", async () => ({
    ok: false,
    json: async () => ({ counts: {} }),
  })), null);
  assert.deepEqual(await loadPageViews("https://metrics.example/api/page-views", async () => ({
    ok: true,
    json: async () => ({ counts: { "sock-pair": 0 } }),
  })), { "sock-pair": 0 });
});

test("everyCatalogAppHasValidPublicationDates", async () => {
  const catalog = JSON.parse(await readFile(new URL("../apps.json", import.meta.url), "utf8"));
  const catalogIds = catalog.apps.map(item => item.id);
  for (const id of APP_IDS) assert.ok(catalogIds.includes(id), `missing catalog app: ${id}`);
  for (const item of catalog.apps) {
    assert.match(item.uploadedAt ?? "", /^\d{4}-\d{2}-\d{2}$/, item.id + " uploadedAt");
    assert.match(item.updatedAt ?? "", /^\d{4}-\d{2}-\d{2}$/, item.id + " updatedAt");
  }
});
