// Add apps and their categories in apps.json; the layout follows the catalog.
import { formatDate, formatPageViews, loadPageViews, sortApps } from "./catalog-sort.js";

const section = document.getElementById("apps");
const developmentSection = document.getElementById("development-apps");
const filterBar = document.getElementById("filter-bar");
const resultCount = document.getElementById("result-count");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const sortControl = document.getElementById("catalog-sort");
const METRICS_URL = "https://tamalab-metrics.tamalab-hub.workers.dev";
const categories = {
  adventure: { label: "ぼうけん" },
  grow: { label: "そだてる" },
  race: { label: "レース" },
  learn: { label: "まなぶ" },
};
let currentFilter = "all";
let currentSort = "featured";
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

function renderCard(app) {
  const category = categories[app.categories?.[0]];
  const isDeveloping = app.status === "development";
  const coverAttributes = `href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(app.name)}であそぶ（あたらしいタブ）"`;
  const card = document.createElement("article");
  card.className = "app-card";
  card.dataset.id = app.id;
  card.dataset.theme = app.tape;
  card.dataset.categories = (app.categories || []).join(" ");
  card.setAttribute("aria-labelledby", `title-${app.id}`);
  card.innerHTML = `
    <a class="app-cover" ${coverAttributes}>
      <span class="cover-meta"><span class="category-label" aria-hidden="true">${esc(category?.label || "あそぶ")}</span>${isDeveloping ? '<span class="development-badge">開発中</span>' : '<span class="cover-arrow" aria-hidden="true">↗</span>'}</span>
      <span class="app-shot"><img src="${esc(app.image)}" alt="${esc(app.imageAlt || app.name)}" width="${esc(app.imageWidth)}" height="${esc(app.imageHeight)}" loading="lazy" decoding="async"></span>
    </a>
    <div class="app-text">
      <p class="app-kana">${esc(app.kana)}</p>
      <h2 class="app-name" id="title-${esc(app.id)}">${esc(app.name)}</h2>
      <p class="app-desc">${esc(app.description)}</p>
      <ul class="app-tags" aria-label="あそびのとくちょう">${app.tags.map((tag) => `<li>${esc(tag)}</li>`).join("")}</ul>
      <dl class="app-metadata" aria-label="アプリの情報">
        <div><dt>アップロード日</dt><dd>${formatDate(app.uploadedAt)}</dd></div>
        <div><dt>更新日</dt><dd>${formatDate(app.updatedAt)}</dd></div>
        <div><dt>アクセス数</dt><dd data-page-views="${esc(app.id)}">${formatPageViews(pageViews?.[app.id])}</dd></div>
      </dl>
      <p class="app-note">${isDeveloping ? "" : '<span class="device-icon" aria-hidden="true"></span>'}<span>${isDeveloping ? "ただいま開発中です。画像をおすと、ためしにあそべます。" : esc(app.note)}</span></p>
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
  resultCount.textContent = `${visible}このあそび`;
}

function renderCatalog() {
  const focusedAppId = document.activeElement?.closest(".app-card")?.dataset.id;
  const publishedApps = sortApps(
    catalogApps.filter((app) => app.status !== "development"),
    currentSort,
    pageViews,
  );
  const developmentApps = sortApps(
    catalogApps.filter((app) => app.status === "development"),
    currentSort,
    pageViews,
  );
  const fragment = document.createDocumentFragment();
  for (const app of publishedApps) fragment.appendChild(renderCard(app));
  const coming = document.createElement("aside");
  coming.className = "coming-card";
  coming.innerHTML = `<div class="coming-art" aria-hidden="true"><span class="coming-block"></span><span class="coming-ball"></span><span class="coming-spark">✧</span></div><h2>つぎは、どんなあそび？</h2><p>あたらしい「たのしい！」を、<br>すこしずつ、つくっています。</p><span class="coming-label">MORE LITTLE JOYS TO COME</span>`;
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
    section.innerHTML = `<div class="load-error" role="alert"><p>あそびを読みこめませんでした。<br>通信をたしかめて、もういちどためしてね。</p><button class="retry-button" type="button">もういちど読みこむ</button></div>`;
    section.querySelector("button").addEventListener("click", render);
  } finally {
    section.setAttribute("aria-busy", "false");
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
