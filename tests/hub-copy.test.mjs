import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const moduleUrl = new URL("../hub-copy.js", import.meta.url);

async function loadHubCopyModule() {
  assert.ok(existsSync(fileURLToPath(moduleUrl)), "hub-copy.js must exist");
  return import(moduleUrl.href);
}

function stringValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

test("childrenHubCopyContainsNoHan", async () => {
  const { HUB_COPY } = await loadHubCopyModule();

  assert.doesNotMatch(
    stringValues(HUB_COPY.children).join(" "),
    /\p{Script=Han}/u,
  );
});

test("bothHubModesProvideTheSameKeys", async () => {
  const { HUB_COPY, getHubCopy } = await loadHubCopyModule();

  assert.deepEqual(
    Object.keys(HUB_COPY.children).sort(),
    Object.keys(HUB_COPY.all).sort(),
  );
  assert.strictEqual(getHubCopy("children"), HUB_COPY.children);
  assert.strictEqual(getHubCopy("all"), HUB_COPY.all);
  assert.strictEqual(getHubCopy("invalid"), HUB_COPY.all);
  assert.equal(HUB_COPY.children.modeAllButton, "ぜんぶ");
  assert.equal(HUB_COPY.children.modeChildrenButton, "こどもむけ");
  assert.equal(HUB_COPY.all.modeAllButton, "すべて表示");
  assert.equal(HUB_COPY.all.modeChildrenButton, "子ども向け表示");
});
