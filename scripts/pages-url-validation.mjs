const APPROVED_PAGES_URL = /^https:\/\/tamalab(?:-|\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.pages\.dev\/$/;
const APPROVED_EXTERNAL_APP_URLS = new Set([
  "https://tama-lab.itch.io/bigblade-knight",
]);

export function isApprovedPagesUrl(value) {
  return typeof value === "string" && APPROVED_PAGES_URL.test(value);
}

export function isApprovedAppUrl(value) {
  return isApprovedPagesUrl(value) || APPROVED_EXTERNAL_APP_URLS.has(value);
}
