export const DEFAULT_CATALOG_MODE = "all";

export function normalizeCatalogMode(mode) {
  return mode === "children" ? "children" : DEFAULT_CATALOG_MODE;
}

export function filterAppsByMode(apps, mode = DEFAULT_CATALOG_MODE) {
  if (normalizeCatalogMode(mode) === "all") return [...apps];
  return apps.filter((app) => app.audience === "child" || app.audience === "family");
}

export function getAppCopy(app, mode = DEFAULT_CATALOG_MODE) {
  return app.copy[normalizeCatalogMode(mode)];
}
