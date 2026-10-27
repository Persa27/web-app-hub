// Add apps and their categories in apps.json; the layout follows the catalog.
import { filterAppsByMode, DEFAULT_CATALOG_MODE, getAppCopy } from "./catalog-audience.js";
import { formatDate, formatPageViews, loadPageViews, sortApps } from "./catalog-sort.js";
import { getHubCopy } from "./hub-copy.js";

const section = document.getElementById("apps");
const developmentSection = document.getElementById("development-apps");
const filterBar = document.getElementById("filter-bar");
const resultCount = document.getElementById("result-count");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const sortControl = document.getElementById("catalog-sort");
const METRICS_URL = "https://tamalab-metrics.tamalab-hub.workers.dev";
const CATEGORY_COPY_KEYS = {
  adventure: "categoryAdventure",
  grow: "categoryGrow",
  race: "categoryRace",
  learn: "categoryLearn",
};
const SORT_COPY_KEYS = {
  featured: "sortFeatured",
  "uploaded-desc": "sortUploadedNewest",
  "uploaded-asc": "sortUploadedOldest",
  "updated-desc": "sortUpdatedNewest",
  "updated-asc": "sortUpdatedOldest",
  "views-desc": "sortViewsMost",
  "views-asc": "sortViewsLeast",
  "updated-uploaded-views-desc": "sortCompound",
};

let currentMode = DEFAULT_CATALOG_MODE;
let currentFilter = "all";
let currentSort = sortControl.value;
let catalogApps = [];
let pageViews = null;
let hasRequestedPageViews = false;

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function applyHubCopy() {
  const copy = getHubCopy(currentMode);
  document.title = copy.documentTitle;

  for (const target of document.querySelectorAll("[data-hub-copy]")) {
    const value = copy[target.dataset.hubCopy];
    if (typeof value === "string") target.textContent = value;
  }

  for (const target of document.querySelectorAll("[data-hub-attr]")) {
    const [attribute, key] = target.dataset.hubAttr.split(":");
    const value = copy[key];
    if (attribute && typeof value === "string") target.setAttribute(attribute, value);
  }

  for (const option of sortControl.options) {
    const key = SORT_COPY_KEYS[option.value];
    if (key) option.textContent = copy[key];
  }

  for (const button of modeButtons) {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function renderCard(app) {
  const copy = getAppCopy(app, currentMode);
  const hubCopy = getHubCopy(currentMode);
  const categoryKey = CATEGORY_COPY_KEYS[app.categories?.[0]];
  const categoryLabel = hubCopy[categoryKey] || hubCopy.categoryFallback;
  const isDeveloping = app.status === "development";
  const coverTag = isDeveloping ? "div" : "a";
  const coverAttributes = isDeveloping
    ? ""
    : ` href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${copy.name}${hubCopy.coverAction}`)}"`;
  const card = document.createElement("article");
  card.className = "app-card";
  card.dataset.id = app.id;
  card.dataset.theme = app.tape;
  card.dataset.categories = (app.categories || []).join(" ");
  card.setAttribute("aria-labelledby", `title-${app.id}`);
  card.innerHTML = `
    <${coverTag} class="app-cover"${coverAttributes}>
      <span class="cover-meta"><span class="category-label" aria-hidden="true">${esc(categoryLabel)}</span>${isDeveloping ? `<span class="development-badge">${esc(hubCopy.developmentBadge)}</span>` : '<span class="cover-arrow" aria-hidden="true">↗</span>'}</span>
      <span class="app-shot"><img src="${esc(app.image)}" alt="${esc(copy.imageAlt)}" width="${esc(app.imageWidth)}" height="${esc(app.imageHeight)}" loading="lazy" decoding="async"></span>
    </${coverTag}>
    <div class="app-text">
      <p class="app-kana">${esc(copy.kana)}</p>
      <h2 class="app-name" id="title-${esc(app.id)}">${esc(copy.name)}</h2>
      <p class="app-desc">${esc(copy.description)}</p>
      <ul class="app-tags" aria-label="${esc(hubCopy.tagsAriaLabel)}">${copy.tags.map((tag) => `<li>${esc(tag)}</li>`).join("")}</ul>
      <dl class="app-metadata" aria-label="${esc(hubCopy.metadataAriaLabel)}">
        <div><dt>${esc(hubCopy.uploadedLabel)}</dt><dd>${formatDate(app.uploadedAt)}</dd></div>
        <div><dt>${esc(hubCopy.updatedLabel)}</dt><dd>${formatDate(app.updatedAt)}</dd></div>
        <div><dt>${esc(hubCopy.pageViewsLabel)}</dt><dd data-page-views="${esc(app.id)}">${formatPageViews(pageViews?.[app.id])}</dd></div>
      </dl>
      <p class="app-note">${isDeveloping ? "" : '<span class="device-icon" aria-hidden="true"></span>'}<span>${esc(isDeveloping ? hubCopy.developmentCardNotice : copy.note)}</span></p>
    </div>`;
  return card;
}

function applyFilter(value) {
  currentFilter = value;
  let visible = 0;
  for (const card of section.querySelectorAll(".app-card")) {
    card.hidden =
      value !== "all" && !card.dataset.categories.split(" ").includes(value);
    if (!card.hidden) visible++;
  }
  const coming = section.querySelector(".coming-card");
  if (coming) coming.hidden = value !== "all";
  for (const button of filterButtons) {
    const active = button.dataset.filter === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  resultCount.textContent = getHubCopy(currentMode).resultCount.replace(
    "{count}",
    String(visible),
  );
}

function renderCatalog() {
  const focusedAppId = document.activeElement?.closest(".app-card")?.dataset.id;
  const visibleApps = filterAppsByMode(catalogApps, currentMode);
  const publishedApps = sortApps(
    visibleApps.filter((app) => app.status !== "development"),
    currentSort,
    pageViews,
  );
  const developmentApps = sortApps(
    visibleApps.filter((app) => app.status === "development"),
    currentSort,
    pageViews,
  );
  const copy = getHubCopy(currentMode);
  const fragment = document.createDocumentFragment();
  for (const app of publishedApps) fragment.appendChild(renderCard(app));
  const coming = document.createElement("aside");
  coming.className = "coming-card";
  coming.innerHTML = `<div class="coming-art" aria-hidden="true"><span class="coming-block"></span><span class="coming-ball"></span><span class="coming-spark">✧</span></div><h2>${esc(copy.comingTitle)}</h2><p>${esc(copy.comingDescription)}</p><span class="coming-label">${esc(copy.comingLabel)}</span>`;
  fragment.appendChild(coming);
  section.replaceChildren(fragment);
  const developmentFragment = document.createDocumentFragment();
  for (const app of developmentApps)
    developmentFragment.appendChild(renderCard(app));
  developmentSection.replaceChildren(developmentFragment);
  document.getElementById("development").hidden = !developmentApps.length;
  document.getElementById("total-count").textContent = publishedApps.length;
  applyFilter(currentFilter);
  if (focusedAppId) {
    const focusedCard = [...document.querySelectorAll(".app-card")]
      .find((card) => card.dataset.id === focusedAppId);
    focusedCard?.querySelector(".app-cover")?.focus({ preventScroll: true });
  }
}

async function render() {
  section.setAttribute("aria-busy", "true");
  filterBar.hidden = true;
  try {
    const response = await fetch("apps.json", { cache: "no-cache" });
    if (!response.ok)
      throw new Error(`Catalog request failed: ${response.status}`);
    const { apps } = await response.json();
    if (!Array.isArray(apps) || !apps.length)
      throw new Error("The catalog is empty");
    if (!apps.some((app) => app.status !== "development"))
      throw new Error("The published catalog is empty");
    catalogApps = apps;
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
    const copy = getHubCopy(currentMode);
    section.innerHTML = `<div class="load-error" role="alert"><p>${esc(copy.loadError)}</p><button class="retry-button" type="button">${esc(copy.retryButton)}</button></div>`;
    section.querySelector("button").addEventListener("click", render);
  } finally {
    section.setAttribute("aria-busy", "false");
  }
}

for (const button of filterButtons) {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode === "children" ? "children" : "all";
    applyHubCopy();
    renderCatalog();
  });
}

sortControl.addEventListener("change", () => {
  currentSort = sortControl.value;
  renderCatalog();
});

applyHubCopy();
render();
