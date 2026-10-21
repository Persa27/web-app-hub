import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_CATALOG_MODE, filterAppsByMode, getAppCopy, normalizeCatalogMode } from "../catalog-audience.js";

const catalogUrl = new URL("../apps.json", import.meta.url);
const hubHtmlUrl = new URL("../index.html", import.meta.url);

async function loadCatalogApps() {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  return catalog.apps;
}

function stringsIn(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

const apps = [
  { id: "child-one", audience: "child" },
  { id: "family-one", audience: "family" },
  { id: "general-one", audience: "general" },
];

test("defaultsAndUnknownModeToAll", async () => {
  assert.equal(DEFAULT_CATALOG_MODE, "all");
  assert.equal(normalizeCatalogMode(undefined), "all");
  assert.equal(normalizeCatalogMode("unknown"), "all");
  assert.deepEqual(
    filterAppsByMode(apps).map((app) => app.id),
    ["child-one", "family-one", "general-one"],
  );
  assert.deepEqual(
    filterAppsByMode(apps, "unknown").map((app) => app.id),
    ["child-one", "family-one", "general-one"],
  );
});

test("filtersChildModeToChildAndFamilyWithoutMutatingSource", async () => {
  const original = [...apps];

  const visible = filterAppsByMode(apps, "children");

  assert.deepEqual(visible.map((app) => app.id), ["child-one", "family-one"]);
  assert.notStrictEqual(visible, apps);
  assert.deepEqual(apps, original);
});

test("hubAudienceModeControlsDefaultToAllWithAccessibleState", async () => {
  const html = await readFile(hubHtmlUrl, "utf8");
  const group = html.match(/<div class="catalog-modes"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(group, "catalog mode controls must be present");

  const controls = [...group[1].matchAll(/<button\b(?=[^>]*\bdata-mode="([^"]+)")(?=[^>]*\baria-pressed="(true|false)")[^>]*>/g)]
    .map(([, mode, pressed]) => ({ mode, pressed }));

  assert.deepEqual(controls, [
    { mode: "all", pressed: "true" },
    { mode: "children", pressed: "false" },
  ]);
});

test("resolvesModeSpecificCopy", async () => {
  const childCopy = { name: "こどものなまえ" };
  const allCopy = { name: "大人向けの名称" };
  const app = { copy: { children: childCopy, all: allCopy } };

  assert.strictEqual(getAppCopy(app, "children"), childCopy);
  assert.strictEqual(getAppCopy(app), allCopy);
  assert.strictEqual(getAppCopy(app, "unknown"), allCopy);
});

test("catalogModesIncludeExpectedIds", async () => {
  const catalogApps = await loadCatalogApps();
  const expectedAudiences = {
    child: [
      "ballrace",
      "mogumon",
      "fossil-excavation",
      "math-marathon",
      "quiz-zukan",
      "shatepon",
    ],
    family: ["treasure"],
    general: ["sock-pair", "chimo", "triad-io", "sentinel-blacklist"],
  };
  const actualAudienceIds = Object.fromEntries(
    Object.keys(expectedAudiences).map((audience) => [
      audience,
      catalogApps
        .filter((app) => app.audience === audience)
        .map((app) => app.id)
        .sort(),
    ]),
  );

  for (const [audience, expectedIds] of Object.entries(expectedAudiences)) {
    assert.deepEqual(actualAudienceIds[audience], [...expectedIds].sort(), audience);
  }
  assert.equal(catalogApps.length, 11);
  assert.deepEqual(
    filterAppsByMode(catalogApps, "children").map((app) => app.id),
    [
      "ballrace",
      "mogumon",
      "treasure",
      "fossil-excavation",
      "math-marathon",
      "quiz-zukan",
      "shatepon",
    ],
  );
  assert.deepEqual(
    filterAppsByMode(catalogApps).map((app) => app.id),
    catalogApps.map((app) => app.id),
  );
  assert.deepEqual(
    filterAppsByMode(catalogApps, "children")
      .filter((app) => app.status === "development")
      .map((app) => app.id),
    ["ballrace", "math-marathon", "shatepon"],
  );
});

test("everyCatalogAppHasCompleteCopyVariants", async () => {
  const catalogApps = await loadCatalogApps();
  const audiences = new Set(["child", "family", "general"]);
  const copyKeys = ["name", "kana", "description", "tags", "imageAlt", "note"];
  const oldTopLevelCopyKeys = copyKeys;

  for (const app of catalogApps) {
    assert.ok(audiences.has(app.audience), app.id + " audience");
    for (const mode of ["children", "all"]) {
      const copy = app.copy?.[mode];
      assert.ok(copy, app.id + " copy." + mode);
      for (const key of copyKeys) {
        if (key === "tags") {
          assert.ok(Array.isArray(copy[key]), app.id + " copy." + mode + ".tags");
          assert.ok(copy[key].every((tag) => typeof tag === "string"), app.id + " tags must be strings");
        } else {
          assert.equal(typeof copy[key], "string", app.id + " copy." + mode + "." + key);
        }
      }
    }
    for (const key of oldTopLevelCopyKeys) {
      assert.equal(Object.hasOwn(app, key), false, app.id + " duplicate top-level " + key);
    }
    assert.match(stringsIn(app.copy.all).join(" "), /\p{Script=Han}/u, app.id + " all copy uses kanji");
  }
});

test("childrenCopyContainsNoHan", async () => {
  const catalogApps = await loadCatalogApps();

  for (const app of catalogApps) {
    const childCopy = app.copy?.children;
    assert.ok(childCopy, app.id + " copy.children must exist");
    assert.doesNotMatch(
      stringsIn(childCopy).join(" "),
      /\p{Script=Han}/u,
      app.id + " child copy must contain no Han characters",
    );
  }
});
