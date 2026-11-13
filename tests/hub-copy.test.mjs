import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HUB_COPY, getHubCopy } from "../hub-copy.js";

test("hubCopyIsASingleAdultVoice", () => {
  assert.strictEqual(getHubCopy(), HUB_COPY);
  for (const [key, value] of Object.entries(HUB_COPY)) assert.equal(typeof value, "string", key);
  assert.equal("children" in HUB_COPY, false);
});

test("hubNoLongerOffersAChildrenDisplayMode", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /data-mode=/);
  assert.doesNotMatch(html, /catalog-modes/);
});

test("hubHasPickupMainFloorFamilyCornerAndGuide", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  for (const id of ["pickup", "floor", "family", "guide"]) {
    assert.match(html, new RegExp(`<section[^>]*\\bid="${id}"`), id);
  }
});

test("privacyDisclosureRotatesOnlyItsDecorativeIcon", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
  const summary = html.match(/<details class="guide-details">[\s\S]*?<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "";

  assert.match(summary, /<span class="privacy-summary-label">/);
  assert.match(summary, /<span class="privacy-summary-icon" aria-hidden="true">/);
  assert.match(css, /\.guide-details\[open\]\s+summary\s+\.privacy-summary-icon\s*\{\s*transform:\s*rotate\(45deg\);/);
});
