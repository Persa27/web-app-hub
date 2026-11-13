// Catalog rules: which floor an app belongs to, what is on the pickup screen,
// and the price tags every app must carry.
export const FAMILY_AUDIENCES = new Set(["child", "family"]);

export function isDevelopment(app) {
  return app.status === "development";
}

export function isFamilyApp(app) {
  return FAMILY_AUDIENCES.has(app.audience);
}

export function splitByFloor(apps) {
  return {
    main: apps.filter((app) => !isFamilyApp(app)),
    family: apps.filter(isFamilyApp),
  };
}

// Pickup slots are hand-picked in apps.json with `pickup: 1, 2, …`.
// Unplayable (in-development) apps never take the front screen.
export function getPickupApps(apps) {
  return apps
    .filter((app) => Number.isSafeInteger(app.pickup) && app.pickup > 0 && !isDevelopment(app))
    .sort((left, right) => left.pickup - right.pickup);
}

export function getAppCopy(app) {
  return app.copy;
}

// Every app shows how it is paid for before anyone opens it.
export function getPriceTags(app) {
  const { price = 0, ads = false, iap = false } = app.pricing ?? {};
  const tags = [];
  if (Number.isSafeInteger(price) && price > 0) {
    tags.push({ kind: "paid", label: `¥${new Intl.NumberFormat("ja-JP").format(price)}` });
  } else {
    tags.push({ kind: "free", label: "無料" });
  }
  if (ads) tags.push({ kind: "ads", label: "広告あり" });
  if (iap) tags.push({ kind: "iap", label: "アプリ内課金あり" });
  return tags;
}
