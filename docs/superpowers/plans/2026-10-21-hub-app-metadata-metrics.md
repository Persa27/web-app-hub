# Hub App Metadata and Page View Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each catalog app's upload date, update date, and cumulative page views in Hub, with sorting by each value, while counting direct visits and reloads on all 11 apps.

**Architecture:** A common Cloudflare Worker accepts app page views and reads totals from one SQLite-backed Durable Object instance per app ID. The Worker serves a small shared client script; each app's Pages build includes it once. Hub reads the totals, combines them with dates in `apps.json`, and stably sorts the published and development lists separately.

**Tech Stack:** Cloudflare Workers, SQLite-backed Durable Objects, Cloudflare Pages, Wrangler 4.151.1, Node.js 22+, browser JavaScript, built-in `node:test`, Godot 4.7.2 Web exports for Sock Pair and Shatepon.

**Spec:** [docs/superpowers/specs/2026-10-21-hub-app-metadata-metrics-design.md](../specs/2026-10-21-hub-app-metadata-metrics-design.md)

## Global Constraints

- Count each app document load once; a reload adds another page view.
- Do not generate or save user IDs, cookies, session data, IP addresses, or User-Agent values in app or Durable Object data.
- Persist only app IDs and their integer totals; do not create per-visit records.
- Seed `uploadedAt` from the earliest Pages production deployment and `updatedAt` from the latest production deployment at rollout; update `updatedAt` during later app releases. Do not backfill Vercel history.
- Display dates as Japan-time `YYYY/MM/DD`.
- Include all 11 IDs: `sock-pair`, `chimo`, `ballrace`, `mogumon`, `treasure`, `fossil-excavation`, `math-marathon`, `quiz-zukan`, `sentinel-blacklist`, `shatepon`, and `triad-io`.
- Keep published and development lists separate; one sort selection applies to both without moving cards between lists. Preserve catalog order for the default and ties.
- Support upload date and update date in both directions, plus page views high-to-low and low-to-high. Keep category filtering active.
- If metrics are unavailable, games and Hub still load and the access count displays `—`; missing values sort last.
- Keep the approved JavaScript-disabled `one-cut-balance` fallback link; it is outside the 11-app catalog and is not instrumented in this work.
- The public counter is approximate and can be spoofed by a direct HTTP caller; do not add visitor identity or authentication.
- Work on dedicated feature branches in each repository. Record each repository's starting dirty state, preserve pre-existing changes, and selectively stage only this feature's hunks. If a target file has overlapping unrelated edits that cannot be separated safely, leave that commit pending and report it instead of including those edits.

## Review Focus

- Malformed JSON or an unknown app ID must return a client error without changing a counter; cover in [Worker route tests](../../../workers/metrics/tests/worker.test.mjs).
- An unapproved production Origin must not increment a total; cover app and Hub Origins in [Worker CORS tests](../../../workers/metrics/tests/worker.test.mjs).
- Concurrent requests for one app must not lose increments; cover with the local Wrangler concurrency smoke test in Task 1.
- A Worker or Durable Object failure must not prevent a game from starting or Hub cards from rendering; cover the served client failure behavior in [Worker route tests](../../../workers/metrics/tests/worker.test.mjs) and the Hub fallback in [catalog tests](../../../tests/catalog-sort.test.mjs), then verify both in Task 14.
- Zero, unavailable, missing-date, and tied values must display and sort predictably; cover in [catalog tests](../../../tests/catalog-sort.test.mjs).

---

### Task 1: Build the shared metrics Worker

**Repository:** `D:/work/web-app-hub`

**Files:**
- Create: `workers/metrics/wrangler.jsonc`
- Create: `workers/metrics/src/index.js`
- Create: `workers/metrics/src/page-view-counter.js`
- Create: `workers/metrics/tests/worker.test.mjs`
- Create: `workers/metrics/tests/local-concurrency-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- `POST /api/page-view` accepts `{ "appId": "<catalog-id>" }` from an allowed app Origin and returns `204` after one increment.
- `GET /api/page-views` returns `{ "counts": { "sock-pair": 0, ... } }` for all 11 IDs; a missing row is zero.
- `GET /client.js?app=<catalog-id>` returns a deferred client script with that validated app ID embedded; it posts once with `credentials: "omit"` and `keepalive: true`, and swallows network errors so it cannot block game startup.
- The Worker routes each valid app ID to `PAGE_VIEWS.idFromName(appId)`. Each `PageViewCounter` instance stores only that app ID and its total in SQLite.

- [ ] **Step 1: Add failing route and storage tests** named `servesOneClientForKnownApp`, `clientIgnoresPostFailure`, `incrementsKnownAppFromAllowedOrigin`, `rejectsMalformedJsonWithoutWriting`, `rejectsUnknownAppIdWithoutWriting`, `rejectsDisallowedOrigin`, and `returnsAllTotalsWithZeroDefaults`; test the Hub Origin on stats reads and app Origins on increments. Add `test:metrics`, `test:metrics:local`, and `deploy:metrics` scripts; the local smoke script starts Wrangler and sends concurrent requests.
- [ ] **Step 2: Run `npm run test:metrics` and confirm the new tests fail** because the Worker and binding do not exist.
- [ ] **Step 3: Implement the Worker routes and `PageViewCounter`**. Use the current Wrangler `exports` configuration with SQLite storage, validate app IDs against the fixed 11-ID list, and handle CORS preflight for JSON POSTs.
- [ ] **Step 4: Run `npm run test:metrics`, `npm run test:metrics:local`, and `npx wrangler@4.151.1 deploy --dry-run --config workers/metrics/wrangler.jsonc`**; confirm 50 simultaneous requests produce exactly 50 increments, all route tests pass, and Wrangler accepts the SQLite Durable Object binding.
- [ ] **Step 5: Commit only the Worker files and `package.json`** with `feat: add app page view metrics worker`.

### Task 2: Add metadata, counts, and sorting to Hub

**Repository:** `D:/work/web-app-hub`

**Files:**
- Modify: `apps.json`, `index.html`, `main.js`, `style.css`, `pages-assets.json`, `package.json`
- Create: `catalog-sort.js`, `tests/catalog-sort.test.mjs`

**Interfaces:**
- `sortApps(apps, sortMode, pageViews)` returns a new stable array; supported modes are `featured`, `uploaded-desc`, `uploaded-asc`, `updated-desc`, `updated-asc`, `views-desc`, and `views-asc`.
- `formatDate(value)` formats a valid `YYYY-MM-DD` as `YYYY/MM/DD` and returns `—` for a missing value.
- `loadPageViews(workerUrl, fetcher = fetch)` returns the ID-to-count map, or `null` on an HTTP or network failure.
- Hub reads the Worker stats once, treats a failed request as unavailable counts, and passes counts into card rendering and sorting.

- [ ] **Step 1: Add failing catalog tests** named `sortsEachFieldInBothDirections`, `keepsCatalogOrderForTies`, `placesMissingValuesLast`, `formatsDateAndMissingDate`, and `keepsCountsUnavailableOnFetchFailure`; include the `test:catalog` package script.
- [ ] **Step 2: Run `node --test tests/catalog-sort.test.mjs` and confirm the tests fail** because the sort module and metadata fields are absent.
- [ ] **Step 3: Add valid `uploadedAt` and `updatedAt` dates to all 11 app entries** using Pages production deployment history; add an accessible sort selector and card metadata; render cards immediately with `—` counts, fetch counts once, then update counts and resort without blocking rendering; apply the same selected mode independently to both lists.
- [ ] **Step 4: Run `node --test tests/catalog-sort.test.mjs`, `npm run test:pages`, and `npm run build:pages`**; confirm every catalog item renders all three fields, category filtering still works, and the existing “coming” card stays last in the published list.
- [ ] **Step 5: Commit only the Hub feature files** with `feat: show app metadata and sortable page views`.

### Task 3: Instrument Shatepon's Godot Pages build

**Repository:** `D:/work-godot/increment-kids-medal`

**Files:**
- Modify: `tools/prepare_web_pages.mjs`, `tests/web_delivery.test.mjs`
- Generated input: `build/web-export/index.html`
- Output under test: `build/web-static-pages/index.html`

**Interfaces:** The prepared HTML contains exactly one `https://tamalab-metrics.tamalab-hub.workers.dev/client.js?app=shatepon` script. The Godot game logic and exported pack remain unchanged.

- [ ] **Step 1: Extend `tests/web_delivery.test.mjs`** to assert the generated HTML contains that script exactly once.
- [ ] **Step 2: Regenerate the existing Web export** with `& D:/work-godot/Godot_v4.7.2-stable_win64.exe --headless --path D:/work-godot/increment-kids-medal --export-release "Shatepon Web" build/web-export/index.html`; run `node tools/prepare_web_pages.mjs` and `node --test tests/web_delivery.test.mjs`, confirming only the new tag assertion fails.
- [ ] **Step 3: Inject the script tag in `tools/prepare_web_pages.mjs`** while constructing the static Pages output.
- [ ] **Step 4: Re-run the prepare command and test**; confirm existing size, hash, and static delivery assertions still pass.
- [ ] **Step 5: Commit only the build script and test** with `feat: count Shatepon page views`.

### Task 4: Instrument Sock Pair's Godot Pages build

**Repository:** `D:/work-godot/sock-pair`

**Files:**
- Modify: `tools/build-pages.mjs`, `tests/pages-build.test.mjs`
- Output under test: `.pages-release/index.html`

**Interfaces:** The generated HTML contains exactly one metrics script ending in `client.js?app=sock-pair`; the Godot export and game code are unchanged.

- [ ] **Step 1: Extend `tests/pages-build.test.mjs`** to assert the generated HTML contains the `sock-pair` client tag exactly once.
- [ ] **Step 2: Regenerate the existing Web export** with `& D:/work-godot/Godot_v4.7.2-stable_win64.exe --headless --path D:/work-godot/sock-pair --export-release Web build/web/index.html`; run `npm run build:pages` and `npm run test:pages`, confirming only the new tag assertion fails.
- [ ] **Step 3: Inject the script tag in `tools/build-pages.mjs`** after reading the Godot export HTML and before writing `.pages-release/index.html`.
- [ ] **Step 4: Run `npm run test:pages`**; confirm the tracking tag is present and WASM reconstruction and existing asset assertions pass.
- [ ] **Step 5: Commit only the build script and test** with `feat: count Sock Pair page views`.

### Task 5: Instrument Chimo Race

**Repository:** `D:/work/chimo-race`

**Files:**
- Modify: `index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-release/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=chimo`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts the `chimo` tag occurs exactly once in `.pages-release/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to the root `index.html`** without changing Vite entry modules.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the Pages build.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count Chimo Race page views`.

### Task 6: Instrument Ball Race

**Repository:** `D:/work/ball-race`

**Files:**
- Modify: `index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=ballrace`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `ballrace` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to the root `index.html`** without changing the game entry module.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the Pages build.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count Ball Race page views`.

### Task 7: Instrument AR Treasure Hunt

**Repository:** `D:/work/indoor-treasure-hunt`

**Files:**
- Modify: `index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=treasure`; existing camera permissions and headers remain unchanged.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `treasure` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to the root `index.html`** without changing the AR initialization module.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the Pages build and existing header configuration remains untouched.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count AR Treasure Hunt page views`.

### Task 8: Instrument Mogumon

**Repository:** `D:/work/mogumon`

**Files:**
- Modify: `public/index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=mogumon`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `mogumon` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to `public/index.html`** without changing game storage or logic.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the allowlisted Pages build.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count Mogumon page views`.

### Task 9: Instrument Fossil Excavation

**Repository:** `D:/work/kaseki-excavation`

**Files:**
- Modify: `src/fossil_excavation_voxel_compact.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The copied root page contains one client script ending in `client.js?app=fossil-excavation`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `fossil-excavation` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to `src/fossil_excavation_voxel_compact.html`**; keep the existing `to: index.html` mapping and add no other published files.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the output still has root-relative behavior and contains the tag once.
- [ ] **Step 5: Commit only the source HTML and test** with `feat: count Fossil Excavation page views`.

### Task 10: Instrument Math Marathon

**Repository:** `D:/work/math-marathon`

**Files:**
- Modify: `index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=math-marathon`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `math-marathon` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to the root `index.html`** without changing React startup code.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the Pages build.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count Math Marathon page views`.

### Task 11: Instrument Quiz Zukan

**Repository:** `D:/work/quiz-zukan`

**Files:**
- Modify: `index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The source and Pages output contain one client script ending in `client.js?app=quiz-zukan`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `quiz-zukan` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to the root `index.html`** without changing quiz initialization or saved results.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag survives the allowlisted Pages build.
- [ ] **Step 5: Commit only the HTML and test** with `feat: count Quiz Zukan page views`.

### Task 12: Instrument SENTINEL

**Repository:** `D:/work/sentinel-blacklist`

**Files:**
- Modify: `deploy/sentinel-blacklist/index.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The deployed root HTML contains one client script ending in `client.js?app=sentinel-blacklist`.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `sentinel-blacklist` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to `deploy/sentinel-blacklist/index.html`**; do not edit the similarly named root `sentinel_blacklist.html` or promo pages.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm only the intended deployment entry is instrumented.
- [ ] **Step 5: Commit only the deployment HTML and test** with `feat: count SENTINEL page views`.

### Task 13: Instrument TRIAD.io

**Repository:** `D:/work/triad.io`

**Files:**
- Modify: `triad_io.html`
- Create: `tests/pageview-injection.test.mjs`
- Output under test: `.pages-dist/index.html`

**Interfaces:** The copied root HTML contains one client script ending in `client.js?app=triad-io`; the unrelated `pv/index.html` is not instrumented.

- [ ] **Step 1: Add a failing build-output test** that runs `npm run build:pages` itself and asserts exactly one `triad-io` client tag in `.pages-dist/index.html`.
- [ ] **Step 2: Run `node --test tests/pageview-injection.test.mjs` and confirm it fails** because the freshly built entry has no client tag.
- [ ] **Step 3: Add the deferred client script to `triad_io.html`**.
- [ ] **Step 4: Run `npm run build:pages` and `node --test tests/pageview-injection.test.mjs`**; confirm the tag is in `.pages-dist/index.html` once.
- [ ] **Step 5: Commit only the source HTML and test** with `feat: count TRIAD.io page views`.

### Task 14: Deploy in order and verify live counts

**Repositories:** Hub plus the 11 app repositories listed above.

**Interfaces:** All local tests and builds pass before production deployment. The deployed Worker URL is the `workers.dev` URL reported by Wrangler for `tamalab-metrics`; use that exact URL in the shared client tags and Hub API constant.

- [ ] **Step 1: Run all Worker and Hub tests and build the Hub; run every app's page-injection test (each test rebuilds its Pages output). Before those tests, regenerate Shatepon with `& D:/work-godot/Godot_v4.7.2-stable_win64.exe --headless --path D:/work-godot/increment-kids-medal --export-release "Shatepon Web" build/web-export/index.html` and Sock Pair with `& D:/work-godot/Godot_v4.7.2-stable_win64.exe --headless --path D:/work-godot/sock-pair --export-release Web build/web/index.html`. Stop if an existing unrelated failure prevents a reliable output.
- [ ] **Step 2: Deploy the metrics Worker with `npm run deploy:metrics`**; verify the 11-key zero-count response and CORS from Hub and app origins, and record the exact Worker URL reported by Wrangler. If the URL differs from the source constant, update the client tags and Hub constant and rerun their tests/builds before app deployment.
- [ ] **Step 3: Deploy and verify each app sequentially** using its existing `npm run deploy:pages` command (Shatepon uses `npx wrangler@4.151.1 pages deploy build/web-static-pages --project-name tamalab-shatepon --branch main --commit-dirty=true`). For each production URL, record the count, open the app, confirm it rises by one, reload, and confirm it rises by one again. Keep the counter total; do not reset or backfill it.
- [ ] **Step 4: Set each `updatedAt` to the actual Japan calendar date of its completed production deployment**, retain the earliest Pages date in `uploadedAt`, then run Hub metadata and build tests again.
- [ ] **Step 5: Deploy Hub with `npm run deploy:pages`** and verify all 11 cards show dates and counts; try all six metric sort directions, default catalog order, category filters, and separate published/development lists at desktop and mobile widths.
- [ ] **Step 6: Simulate Worker failure** by blocking the Worker origin in the browser verification path; confirm Hub cards remain visible with `—` counts and instrumented games remain playable.
- [ ] **Step 7: Record deployment URLs or IDs, the counter start date, test outcomes, and any browser limitations** in `docs/cloudflare-migration-status.md`; commit only the Hub metadata and status record.

