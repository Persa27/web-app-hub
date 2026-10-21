import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const moduleUrl = new URL("../catalog-audience.js", import.meta.url);

async function loadAudienceModule() {
  assert.ok(existsSync(fileURLToPath(moduleUrl)), "catalog-audience.js must exist");
  return import(moduleUrl.href);
}

const apps = [
  { id: "child-one", audience: "child" },
  { id: "family-one", audience: "family" },
  { id: "general-one", audience: "general" },
];

test("defaultsAndUnknownModeToAll", async () => {
  const { DEFAULT_CATALOG_MODE, normalizeCatalogMode, filterAppsByMode } =
    await loadAudienceModule();

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
  const { filterAppsByMode } = await loadAudienceModule();
  const original = [...apps];

  const visible = filterAppsByMode(apps, "children");

  assert.deepEqual(visible.map((app) => app.id), ["child-one", "family-one"]);
  assert.notStrictEqual(visible, apps);
  assert.deepEqual(apps, original);
});

test("resolvesModeSpecificCopy", async () => {
  const { getAppCopy } = await loadAudienceModule();
  const childCopy = { name: "こどものなまえ" };
  const allCopy = { name: "大人向けの名称" };
  const app = { copy: { children: childCopy, all: allCopy } };

  assert.strictEqual(getAppCopy(app, "children"), childCopy);
  assert.strictEqual(getAppCopy(app), allCopy);
  assert.strictEqual(getAppCopy(app, "unknown"), allCopy);
});
