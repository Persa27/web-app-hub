// apps.json を読んでアプリカードを描画する。
// アプリを増やすときは apps.json にエントリを足すだけでよい。

async function render() {
  const res = await fetch("apps.json");
  const { apps } = await res.json();
  const section = document.getElementById("apps");

  for (const app of apps) {
    const card = document.createElement("article");
    card.className = "app-card";
    card.innerHTML = `
      <span class="tape tape-${esc(app.tape)}" aria-hidden="true"></span>
      <div class="app-body">
        <div class="app-shot">
          <img src="${esc(app.image)}" alt="${esc(app.name)}のがめん" loading="lazy">
        </div>
        <div class="app-text">
          <h2 class="app-name">${esc(app.name)}</h2>
          <p class="app-kana">${esc(app.kana)}</p>
          <p class="app-desc">${esc(app.description)}</p>
          <ul class="app-tags">${app.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <p class="app-note">${esc(app.note)}</p>
          <a class="play-btn" href="${esc(app.url)}" target="_blank" rel="noopener">あそんでみる &#x2192;</a>
        </div>
      </div>`;
    section.appendChild(card);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

render();
