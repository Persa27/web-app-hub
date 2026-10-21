# Hub Audience Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a child-only Hub view and a complete Hub view, with audience-appropriate copy for every mode.

**Architecture:** Keep the catalog in `apps.json`, mark each work as child, family, or general, and store complete copy variants for both modes. Pure audience helpers and a shared mode-copy map keep filtering and copy decisions testable; `main.js` applies the selected mode while preserving existing catalog, metrics, category, and sort behavior.

**Tech Stack:** Vanilla JavaScript ES modules, HTML, CSS, JSON, Node.js built-in test runner, Cloudflare Pages via Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-21-hub-audience-modes-design.md`

## Global Constraints

- The change is limited to the Hub. The applications themselves, their URLs, and their in-app copy do not change.
- The complete mode is selected on every fresh page load. Mode choice is not saved between page loads.
- The child view therefore contains seven works; the complete view contains all eleven.
- In child mode, every displayed text and accessibility label across the Hub uses child-facing copy and contains no Han-script characters.
- Keep the default compound sort (updated date descending, then upload date descending, then page views descending), other sort choices, page-view fetch, and open-in-new-tab behavior.

## Review Focus

- An omitted or invalid mode must safely select the complete view; pin this in Task 1 with `defaultsAndUnknownModeToAll`.
- AR treasure must remain in the child view while the four general-audience works are excluded from both catalog sections; pin exact IDs and counts in Task 2 with `catalogModesIncludeExpectedIds`.
- A kanji character can leak through any one card field or shared label, including alt text and controls; scan all child variant fields in Task 2 and the complete `HUB_COPY.children` dictionary in Task 3 with `childrenCopyContainsNoHan` and `childrenHubCopyContainsNoHan`, then inspect rendered text in Task 5.
- Switching mode must not reset category or sort and must not count development or coming-soon cards as published results; verify this behavior in Task 5's browser smoke test.
- Sorting, page-view values, grouping, and app links must survive a mode filter; cover filtering without input mutation in Task 1 and re-run existing catalog/build checks plus deployed smoke checks in Task 5.

---

### Task 1: Audience-mode helpers

**Files:**
- Create: `catalog-audience.js`
- Create: `tests/catalog-audience.test.mjs`

**Interfaces:**
- Produces:
  - `DEFAULT_CATALOG_MODE = "all"`
  - `normalizeCatalogMode(mode) -> "all" | "children"`; unknown values normalize to `"all"`.
  - `filterAppsByMode(apps, mode = DEFAULT_CATALOG_MODE) -> App[]`; returns a new array and preserves input order.
  - `getAppCopy(app, mode = DEFAULT_CATALOG_MODE) -> AppCopy`; selects the `all` or `children` copy object.

- [x] **Step 1: Write failing helper tests**

Add tests named `defaultsAndUnknownModeToAll`, `filtersChildModeToChildAndFamilyWithoutMutatingSource`, and `resolvesModeSpecificCopy`. Use small in-memory fixtures; assert that complete mode retains all entries, child mode retains only `child` and `family`, the source array is unchanged, and the correct copy object is returned.

- [x] **Step 2: Run the focused tests and confirm they fail**

Run: `node --test tests/catalog-audience.test.mjs`
Expected: FAIL because `catalog-audience.js` and its exports do not exist.

- [x] **Step 3: Implement the three exports in `catalog-audience.js`**

Normalize any mode other than `"children"` to `"all"`. Filter child mode by audience values `"child"` and `"family"`; do not sort or mutate the supplied array.

- [x] **Step 4: Re-run the focused tests**

Run: `node --test tests/catalog-audience.test.mjs`
Expected: PASS for all helper tests.

- [x] **Step 5: Commit this task**

Stage only `catalog-audience.js` and `tests/catalog-audience.test.mjs`; commit as `feat: add catalog audience mode helpers`.

### Task 2: Classify works and add paired card copy

**Files:**
- Modify: `apps.json`
- Modify: `tests/catalog-audience.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `filterAppsByMode`, `getAppCopy`, and the audience values from Task 1.
- Produces: Every catalog item has `audience` and `copy.children` / `copy.all`, with each copy containing `name`, `kana`, `description`, `tags`, `imageAlt`, and `note`.

- [x] **Step 1: Add catalog contract tests**

Add tests named `catalogModesIncludeExpectedIds`, `everyCatalogAppHasCompleteCopyVariants`, and `childrenCopyContainsNoHan`. Assert the exact six child IDs (`ballrace`, `mogumon`, `fossil-excavation`, `math-marathon`, `quiz-zukan`, `shatepon`), family ID (`treasure`), and four general IDs (`sock-pair`, `chimo`, `triad-io`, `sentinel-blacklist`). Assert the mode helper returns seven child-view entries and all eleven complete-view entries. Recursively scan all child-copy strings for `/\p{Script=Han}/u`; assert each complete-copy bundle contains kanji.

- [x] **Step 2: Run the focused tests and confirm the new contract tests fail**

Run: `node --test tests/catalog-audience.test.mjs`
Expected: FAIL because catalog audience and paired-copy data are absent.

- [x] **Step 3: Populate audience and both copy variants in `apps.json`**

Set the approved audience value on all eleven records. Move the top-level `name`, `kana`, `description`, `tags`, `imageAlt`, and `note` into both complete copy variants, then remove those duplicate top-level copy fields. Write child-facing, kanji-free copy for all child variants; use kana names such as `かせきはっくつ` and `ARたからさがし`. Write adult-facing Japanese copy with kanji for all eleven records. Keep IDs, dates, status, categories, URLs, image paths, dimensions, and theme data unchanged.

- [x] **Step 4: Run the focused tests and register them in the catalog test command**

Run: `node --test tests/catalog-audience.test.mjs`
Expected: PASS, including exact audience membership and no-Han scans. Update `test:catalog` in `package.json` to run both `tests/catalog-sort.test.mjs` and `tests/catalog-audience.test.mjs`; run `npm run test:catalog` and confirm both suites pass.

- [x] **Step 5: Commit this task**

Stage only `apps.json`, `tests/catalog-audience.test.mjs`, and `package.json`; commit as `feat: add audience copy to app catalog`.

### Task 3: Shared mode copy and selector presentation

**Files:**
- Create: `hub-copy.js`
- Create: `tests/hub-copy.test.mjs`
- Modify: `index.html`
- Modify: `style.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `HUB_COPY.children` and `HUB_COPY.all` with matching keys, plus `getHubCopy(mode)` which returns the child dictionary only for `"children"` and otherwise returns the complete dictionary.
- The dictionaries include every shared Hub string: document metadata, navigation, headings, instructions, mode/category/sort controls, status and metadata labels, counts, coming-soon card, parent/privacy text, footer, and accessibility labels.

- [x] **Step 1: Write failing common-copy tests**

Add `childrenHubCopyContainsNoHan` and `bothHubModesProvideTheSameKeys` to `tests/hub-copy.test.mjs`. Recursively inspect `HUB_COPY.children` for Han-script characters; assert both modes have the same complete key set and that `getHubCopy` defaults unknown modes to `all`. Include mode-specific selector labels: child mode uses 「ぜんぶ」 / 「こどもむけ」; complete mode uses 「すべて表示」 / 「子ども向け表示」.

- [x] **Step 2: Run the focused tests and confirm they fail**

Run: `node --test tests/hub-copy.test.mjs`
Expected: FAIL because `hub-copy.js` does not exist.

- [x] **Step 3: Add the shared copy map and implement its selector**

Create `hub-copy.js` with complete child-facing and adult-facing strings. Keep the child dictionary free of Han-script characters, including the inactive mode button label. Adult-facing copy uses kanji and speaks to an adult audience.

- [x] **Step 4: Add the selector and keyed copy targets to `index.html`; style it in `style.css`**

Add an accessible two-button group before the existing category filters, default the complete button to `aria-pressed="true"`, and mark shared text targets for mode updates. Keep the static page and no-JavaScript fallback in complete mode. Add visible focus, active state, and narrow-screen layout for the new controls.

- [x] **Step 5: Run common-copy tests and include them in `test:catalog`**

Run: `node --test tests/hub-copy.test.mjs` and `npm run test:catalog`.
Expected: PASS; both mode dictionaries have matching keys and the complete child-facing dictionary has no Han-script characters. Add `tests/hub-copy.test.mjs` to the `test:catalog` script.

- [x] **Step 6: Commit this task**

Stage only `hub-copy.js`, `tests/hub-copy.test.mjs`, `index.html`, `style.css`, and `package.json`; commit as `feat: add Hub audience mode selector and copy`.

### Task 4: Integrate mode filtering and card rendering

**Files:**
- Modify: `main.js`
- Modify: `tests/catalog-audience.test.mjs` only if a pure regression test is needed for a behavior not already covered.

**Interfaces:**
- Consumes: `DEFAULT_CATALOG_MODE`, `filterAppsByMode`, `getAppCopy`, and `getHubCopy`.
- Produces: the Hub initializes `currentMode` to `"all"`; a mode-button change updates only `currentMode`, applies the selected shared copy, and rerenders catalog cards.

- [x] **Step 1: Add a failing integration assertion for mode behavior**

Add a focused test for the mode-control contract: the complete control is initially pressed, both controls expose `aria-pressed`, and the selected mode value is `all`. Keep the test limited to stable HTML/control data and avoid matching implementation source text.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/catalog-audience.test.mjs`
Expected: FAIL because the mode selector is not integrated into the catalog behavior.

- [x] **Step 3: Update `main.js` to render one selected mode**

Set the default mode to `"all"`; apply `getHubCopy(currentMode)` to all keyed shared text and document metadata; render each card from `getAppCopy(app, currentMode)`; use mode-specific category, status, metadata, and accessibility copy. Filter both published and development collections through `filterAppsByMode` before sorting. Keep existing category-filter scope and count semantics. The mode listener changes no category or sort state, updates `aria-pressed`, and rerenders. Keep asynchronous page-view loading and rerendering in the selected mode.

- [x] **Step 4: Run automated catalog tests**

Run: `npm run test:catalog`
Expected: PASS for audience data, copy invariants, shared copy, and existing sort behavior.

- [x] **Step 5: Commit this task**

Stage only `main.js` and the test file if it changed; commit as `feat: switch Hub catalog by audience mode`.

### Task 5: Full validation and Cloudflare Hub preview

**Files:**
- No source files unless a check uncovers a defect; fix it in the task that owns the relevant file and re-run that task's tests.

**Interfaces:**
- Consumes: the complete mode implementation from Tasks 1–4.
- Produces: a verified Cloudflare Pages branch preview on the existing Hub project and `tamalab` branch.

- [x] **Step 1: Run the full existing test and build checks**

Run: `npm run test:catalog`, `npm run test:pages`, and `npm run build:pages`.
Expected: all tests pass and the Pages build completes.

- [x] **Step 2: Deploy the Hub preview**

Run: `npm run deploy:pages`.
Expected: Wrangler completes a Pages deployment on project `hub`, branch `tamalab`, without changing the configured Hub URL.

- [x] **Step 3: Smoke-test the deployed Hub**

In a browser, verify the fresh page starts in complete mode with eleven works (six published, five development); switching to child mode shows seven works (four published, three development), including AR treasure and excluding the four general works. Verify the coming-soon card is not in counts, category and sort selections survive switching, and reload returns to complete mode. Inspect the rendered child-mode text and accessibility labels for Han-script characters; verify adult copy, mode labels, metadata labels, app links, and new-tab behavior in complete mode.

- [x] **Step 4: Report the deployed preview result**

Capture the deployment URL/id from Wrangler output and include the URL plus the smoke-test result in the handoff. Do not edit or stage the pre-existing migration status document as part of this task.

