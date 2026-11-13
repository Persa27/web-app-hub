import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { getAppCopy, getPickupApps, getPriceTags, splitByFloor } from "../catalog-audience.js";

const catalogUrl = new URL("../apps.json", import.meta.url);

async function loadCatalogApps() {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  return catalog.apps;
}

test("splitsAppsIntoMainFloorAndFamilyCornerWithoutMutatingSource", () => {
  const apps = [
    { id: "child-one", audience: "child" },
    { id: "family-one", audience: "family" },
    { id: "general-one", audience: "general" },
  ];
  const original = structuredClone(apps);

  const { main, family } = splitByFloor(apps);

  assert.deepEqual(main.map((app) => app.id), ["general-one"]);
  assert.deepEqual(family.map((app) => app.id), ["child-one", "family-one"]);
  assert.deepEqual(apps, original);
});

test("pickupKeepsHandPickedOrderAndSkipsUnplayableApps", () => {
  const apps = [
    { id: "second", pickup: 2 },
    { id: "none" },
    { id: "first", pickup: 1 },
    { id: "wip", pickup: 3, status: "development" },
    { id: "bad", pickup: "1" },
  ];

  assert.deepEqual(getPickupApps(apps).map((app) => app.id), ["first", "second"]);
});

test("priceTagsAlwaysStateHowAnAppIsPaidFor", () => {
  assert.deepEqual(getPriceTags({}), [{ kind: "free", label: "無料" }]);
  assert.deepEqual(getPriceTags({ pricing: { price: 0, ads: true } }), [
    { kind: "free", label: "無料" },
    { kind: "ads", label: "広告あり" },
  ]);
  assert.deepEqual(getPriceTags({ pricing: { price: 1200, iap: true } }), [
    { kind: "paid", label: "¥1,200" },
    { kind: "iap", label: "アプリ内課金あり" },
  ]);
});

test("catalogFloorsIncludeExpectedIds", async () => {
  const apps = await loadCatalogApps();
  const { main, family } = splitByFloor(apps);

  assert.equal(apps.length, 14);
  assert.deepEqual(
    main.map((app) => app.id).sort(),
    ["bigblade-knight", "chimo", "sentinel-blacklist", "sock-pair", "triad-io", "vegenetica"],
  );
  assert.deepEqual(
    family.map((app) => app.id).sort(),
    ["ballrace", "fossil-excavation", "math-marathon", "mogumon", "quiz-zukan", "shatepon", "treasure", "umigame-soup"],
  );
  assert.deepEqual(getPickupApps(apps).map((app) => app.id), ["bigblade-knight"]);
});

test("everyCatalogAppHasOneCompleteCopyAndPricing", async () => {
  const apps = await loadCatalogApps();
  const copyKeys = ["name", "kana", "description", "tags", "imageAlt", "note"];

  for (const app of apps) {
    const copy = getAppCopy(app);
    assert.ok(copy && !copy.children && !copy.all, `${app.id} has a single copy`);
    for (const key of copyKeys) {
      if (key === "tags") assert.ok(Array.isArray(copy.tags) && copy.tags.every((tag) => typeof tag === "string"), app.id);
      else assert.equal(typeof copy[key], "string", `${app.id} copy.${key}`);
    }
    assert.ok(Number.isSafeInteger(app.pricing?.price) && app.pricing.price >= 0, `${app.id} pricing.price`);
    assert.equal(typeof app.pricing.ads, "boolean", `${app.id} pricing.ads`);
    assert.equal(typeof app.pricing.iap, "boolean", `${app.id} pricing.iap`);
  }
});

test("pickupVideosPointAtFilesInTheRepository", async () => {
  const apps = await loadCatalogApps();

  for (const app of apps.filter((entry) => entry.video)) {
    const { poster, loop, full } = app.video;
    for (const path of [poster, ...loop.map((source) => source.src), full?.src].filter(Boolean)) {
      assert.match(path, /^media\/pv\//, `${app.id} video lives under media/pv`);
      await access(new URL(`../${path}`, import.meta.url));
    }
  }
});
