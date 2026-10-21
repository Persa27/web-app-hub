const APPROVED_PAGES_URL = /^https:\/\/tamalab(?:-|\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.pages\.dev\/$/;

export function isApprovedPagesUrl(value) {
  return typeof value === "string" && APPROVED_PAGES_URL.test(value);
}
