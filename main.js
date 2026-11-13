// The page is a TV sales floor: apps.json decides what is on each shelf and on the pickup screen.
import { getAppCopy, getPickupApps, getPriceTags, isDevelopment, splitByFloor } from "./catalog-audience.js";
import { formatDate, loadPageViews, sortApps } from "./catalog-sort.js";
import { getHubCopy } from "./hub-copy.js";

const copy = getHubCopy();
const mainFloor = document.getElementById("main-floor");
const familyFloor = document.getElementById("family-floor");
const pickupStage = document.getElementById("pickup-stage");
const filterBar = document.getElementById("filter-bar");
const resultCount = document.getElementById("result-count");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const sortControl = document.getElementById("catalog-sort");
const pvDialog = document.getElementById("pv-dialog");
const METRICS_URL = "https://tamalab-metrics.tamalab-hub.workers.dev";
const CATEGORY_COPY_KEYS = {
  adventure: "categoryAdventure",
  grow: "categoryGrow",
  race: "categoryRace",
  learn: "categoryLearn",
};
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

let currentFilter = "all";
let currentSort = sortControl.value;
let catalogApps = [];
let pageViews = null;
let hasRequestedPageViews = false;
let pickupVideo = null;

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function categoryLabel(app) {
  return copy[CATEGORY_COPY_KEYS[app.categories?.[0]]] || copy.categoryFallback;
}

function priceTagsHtml(app) {
  return `<ul class="price-tags" aria-label="${esc(copy.priceAriaLabel)}">${getPriceTags(app)
    .map((tag) => `<li class="price-tag" data-kind="${esc(tag.kind)}">${esc(tag.label)}</li>`)
    .join("")}</ul>`;
}

function tagsHtml(appCopy) {
  return `<ul class="app-tags" aria-label="${esc(copy.tagsAriaLabel)}">${appCopy.tags
    .map((tag) => `<li>${esc(tag)}</li>`)
    .join("")}</ul>`;
}

// Data saver and very slow links get a still image and a play button instead of autoplay.
function prefersLightPage() {
  const connection = navigator.connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");
}

function renderTv(app) {
  const appCopy = getAppCopy(app);
  const developing = isDevelopment(app);
  const screenTag = developing ? "div" : "a";
  const screenAttributes = developing
    ? ""
    : ` href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${appCopy.name}${copy.playAction}`)}"`;
  const card = document.createElement("article");
  card.className = `tv-card${developing ? " is-off" : ""}`;
  card.dataset.id = app.id;
  card.dataset.theme = app.tape;
  card.dataset.categories = (app.categories || []).join(" ");
  card.setAttribute("aria-labelledby", `title-${app.id}`);
  card.innerHTML = `
    <${screenTag} class="tv"${screenAttributes}>
      <span class="tv-screen">
        <img src="${esc(app.image)}" alt="${esc(appCopy.imageAlt)}" width="${esc(app.imageWidth)}" height="${esc(app.imageHeight)}" loading="lazy" decoding="async">
        ${developing ? `<span class="coming-pop">${esc(copy.comingPop)}</span>` : '<span class="tv-glare" aria-hidden="true"></span>'}
      </span>
      <span class="tv-stand" aria-hidden="true"></span>
    </${screenTag}>
    <div class="pop-card">
      <p class="pop-category">${esc(categoryLabel(app))}</p>
      <h3 class="app-name" id="title-${esc(app.id)}">${esc(appCopy.name)}</h3>
      ${priceTagsHtml(app)}
      <p class="app-desc">${esc(developing ? copy.comingNotice : appCopy.description)}</p>
      <details class="pop-details">
        <summary>${esc(copy.detailsSummary)}</summary>
        <p>${esc(developing ? copy.comingNotice : appCopy.description)}</p>
        ${developing ? "" : `<p class="app-note">${esc(appCopy.note)}</p>`}
      </details>
      ${tagsHtml(appCopy)}
      <dl class="app-metadata" aria-label="${esc(copy.metadataAriaLabel)}">
        <div><dt>${esc(copy.uploadedLabel)}</dt><dd>${formatDate(app.uploadedAt)}</dd></div>
        <div><dt>${esc(copy.updatedLabel)}</dt><dd>${formatDate(app.updatedAt)}</dd></div>
      </dl>
    </div>`;
  if (!developing && app.video?.loop?.length) attachHoverPreview(card, app);
  return card;
}

// Pointing at a TV that has a PV switches it on with a silent preview; touch screens keep the still.
function attachHoverPreview(card, app) {
  const screen = card.querySelector(".tv-screen");
  let video = null;
  card.querySelector(".tv").addEventListener("pointerenter", () => {
    if (!finePointer.matches || reducedMotion.matches || prefersLightPage()) return;
    if (!video) {
      video = document.createElement("video");
      video.className = "tv-preview";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("aria-hidden", "true");
      for (const source of app.video.loop) {
        const element = document.createElement("source");
        element.src = source.src;
        element.type = source.type;
        video.appendChild(element);
      }
      screen.appendChild(video);
    }
    card.classList.add("is-previewing");
    video.play().catch(() => card.classList.remove("is-previewing"));
  });
  card.querySelector(".tv").addEventListener("pointerleave", () => {
    card.classList.remove("is-previewing");
    video?.pause();
  });
}

function renderPickupMain(app) {
  const appCopy = getAppCopy(app);
  const hasVideo = Boolean(app.video?.loop?.length);
  const poster = app.video?.poster || app.image;
  const screen = hasVideo
    ? `<video class="pickup-video" muted loop playsinline preload="none" poster="${esc(poster)}" aria-label="${esc(`${appCopy.name}のPV（音声なし）`)}">
        ${app.video.loop.map((source) => `<source data-src="${esc(source.src)}" type="${esc(source.type)}">`).join("")}
      </video>
      <button type="button" class="pickup-toggle" aria-pressed="false"><span class="pickup-toggle-icon" aria-hidden="true">▶</span><span class="pickup-toggle-label">${esc(copy.pickupPlay)}</span></button>`
    : `<img src="${esc(app.image)}" alt="${esc(appCopy.imageAlt)}" width="${esc(app.imageWidth)}" height="${esc(app.imageHeight)}" fetchpriority="high">`;
  return `
    <article class="pickup-main" data-theme="${esc(app.tape)}" aria-labelledby="pickup-name-${esc(app.id)}">
      <div class="big-tv">
        <div class="big-tv-screen">${screen}</div>
        <span class="big-tv-stand" aria-hidden="true"></span>
      </div>
      <div class="pickup-pop">
        <p class="pickup-ribbon" lang="en">PICK UP</p>
        <p class="pop-category">${esc(categoryLabel(app))}</p>
        <h2 class="pickup-name" id="pickup-name-${esc(app.id)}">${esc(appCopy.name)}</h2>
        ${priceTagsHtml(app)}
        <p class="pickup-desc">${esc(appCopy.description)}</p>
        ${tagsHtml(appCopy)}
        <p class="app-note">${esc(appCopy.note)}</p>
        <div class="pickup-actions">
          <a class="play-button" href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${appCopy.name}${copy.playAction}`)}">${esc(copy.playButton)} <span aria-hidden="true">↗</span></a>
          ${app.video?.full ? `<button type="button" class="pv-button" data-pv="${esc(app.id)}">${esc(copy.pickupFullPv)}</button>` : ""}
        </div>
      </div>
    </article>`;
}

function renderPickupSub(app) {
  const appCopy = getAppCopy(app);
  return `
    <li class="pickup-sub-item" data-theme="${esc(app.tape)}">
      <a class="tv" href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${appCopy.name}${copy.playAction}`)}">
        <span class="tv-screen"><img src="${esc(app.image)}" alt="${esc(appCopy.imageAlt)}" width="${esc(app.imageWidth)}" height="${esc(app.imageHeight)}" loading="lazy" decoding="async"></span>
      </a>
      <p class="pickup-sub-name">${esc(appCopy.name)}</p>
      ${priceTagsHtml(app)}
    </li>`;
}

function renderPickup() {
  const picks = getPickupApps(catalogApps);
  document.getElementById("pickup").hidden = !picks.length;
  if (!picks.length) return;
  const [main, ...rest] = picks;
  pickupStage.dataset.count = String(picks.length);
  pickupStage.innerHTML = `${renderPickupMain(main)}${rest.length ? `<ul class="pickup-sub">${rest.map(renderPickupSub).join("")}</ul>` : ""}`;
  const video = pickupStage.querySelector(".pickup-video");
  if (video) setupPickupVideo(video, pickupStage.querySelector(".pickup-toggle"));
}

// The pickup PV never competes with the first paint: it only starts loading once the page has
// finished loading and the screen is actually in view.
function setupPickupVideo(video, toggle) {
  let loaded = false;
  let userPaused = false;
  let inView = false;
  const label = toggle.querySelector(".pickup-toggle-label");
  const icon = toggle.querySelector(".pickup-toggle-icon");
  const autoplayAllowed = () => !reducedMotion.matches && !prefersLightPage();

  const load = () => {
    if (loaded) return;
    for (const source of video.querySelectorAll("source[data-src]")) source.src = source.dataset.src;
    video.preload = "auto";
    video.load();
    loaded = true;
  };
  const play = () => {
    load();
    video.play().catch(() => {});
  };
  const sync = () => {
    const playing = !video.paused;
    toggle.setAttribute("aria-pressed", String(playing));
    icon.textContent = playing ? "❚❚" : "▶";
    label.textContent = playing ? copy.pickupPause : copy.pickupPlay;
  };
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  toggle.addEventListener("click", () => {
    if (video.paused) {
      userPaused = false;
      play();
    } else {
      userPaused = true;
      video.pause();
    }
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) video.pause();
      else if (!userPaused && autoplayAllowed() && !pvDialog.open) play();
    },
    { threshold: 0.35 },
  );
  const start = () => observer.observe(video);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  pickupVideo = { video, resume: () => inView && !userPaused && autoplayAllowed() && play() };
}

function openPv(app) {
  const video = pvDialog.querySelector("video");
  pvDialog.querySelector("h2").textContent = `${getAppCopy(app).name} PV`;
  video.src = app.video.full.src;
  pickupVideo?.video.pause();
  pvDialog.showModal();
  video.play().catch(() => {});
}

pvDialog.addEventListener("close", () => {
  const video = pvDialog.querySelector("video");
  video.pause();
  video.removeAttribute("src");
  video.load();
  pickupVideo?.resume();
});
pvDialog.addEventListener("click", (event) => {
  if (event.target === pvDialog || event.target.closest("[data-close-dialog]")) pvDialog.close();
});
pickupStage.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pv]");
  const app = button && catalogApps.find((entry) => entry.id === button.dataset.pv);
  if (app?.video?.full) openPv(app);
});

function renderFloor(container, apps) {
  const published = sortApps(apps.filter((app) => !isDevelopment(app)), currentSort, pageViews);
  const developing = sortApps(apps.filter(isDevelopment), currentSort, pageViews);
  const fragment = document.createDocumentFragment();
  for (const app of [...published, ...developing]) fragment.appendChild(renderTv(app));
  const empty = document.createElement("p");
  empty.className = "empty-floor";
  empty.textContent = copy.emptyFloor;
  empty.hidden = true;
  fragment.appendChild(empty);
  container.replaceChildren(fragment);
  return published.length;
}

function applyFilter(value) {
  currentFilter = value;
  let visible = 0;
  for (const container of [mainFloor, familyFloor]) {
    let floorVisible = 0;
    for (const card of container.querySelectorAll(".tv-card")) {
      card.hidden = value !== "all" && !card.dataset.categories.split(" ").includes(value);
      if (!card.hidden) {
        floorVisible++;
        if (!card.classList.contains("is-off")) visible++;
      }
    }
    const empty = container.querySelector(".empty-floor");
    if (empty) empty.hidden = floorVisible > 0;
  }
  for (const button of filterButtons) {
    const active = button.dataset.filter === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  resultCount.textContent = copy.resultCount.replace("{count}", String(visible));
}

function renderCatalog() {
  const focusedAppId = document.activeElement?.closest(".tv-card")?.dataset.id;
  const { main, family } = splitByFloor(catalogApps);
  const total = renderFloor(mainFloor, main) + renderFloor(familyFloor, family);
  document.getElementById("total-count").textContent = total;
  applyFilter(currentFilter);
  if (focusedAppId) {
    document.querySelector(`.tv-card[data-id="${CSS.escape(focusedAppId)}"] .tv`)?.focus({ preventScroll: true });
  }
}

async function render() {
  mainFloor.setAttribute("aria-busy", "true");
  filterBar.hidden = true;
  try {
    const response = await fetch("apps.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const { apps } = await response.json();
    if (!Array.isArray(apps) || !apps.some((app) => !isDevelopment(app))) throw new Error("The published catalog is empty");
    catalogApps = apps;
    renderPickup();
    renderCatalog();
    filterBar.hidden = false;
    if (!hasRequestedPageViews) {
      hasRequestedPageViews = true;
      void loadPageViews(METRICS_URL).then((counts) => {
        if (!counts) return;
        pageViews = counts;
        renderCatalog();
      });
    }
  } catch {
    mainFloor.innerHTML = `<div class="load-error" role="alert"><p>${esc(copy.loadError)}</p><button class="retry-button" type="button">${esc(copy.retryButton)}</button></div>`;
    mainFloor.querySelector("button").addEventListener("click", render);
  } finally {
    mainFloor.setAttribute("aria-busy", "false");
  }
}

for (const button of filterButtons) {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
}

sortControl.addEventListener("change", () => {
  currentSort = sortControl.value;
  renderCatalog();
});

render();
