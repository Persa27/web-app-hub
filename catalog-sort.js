const SORT_MODES = new Set([
  "featured",
  "uploaded-desc",
  "uploaded-asc",
  "updated-desc",
  "updated-asc",
  "views-desc",
  "views-asc",
]);

function dateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return value;
}

function compareKnownValues(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left === right) return 0;
  return (left < right ? -1 : 1) * direction;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function sortApps(apps, sortMode = "featured", pageViews = {}) {
  const mode = SORT_MODES.has(sortMode) ? sortMode : "featured";
  if (mode === "featured") return [...apps];

  const [field, directionName] = mode.split("-");
  const direction = directionName === "asc" ? 1 : -1;
  return apps
    .map((app, index) => ({ app, index }))
    .sort(({ app: left, index: leftIndex }, { app: right, index: rightIndex }) => {
      const leftValue = field === "uploaded"
        ? dateValue(left.uploadedAt)
        : field === "updated"
          ? dateValue(left.updatedAt)
          : validCount(pageViews?.[left.id]);
      const rightValue = field === "uploaded"
        ? dateValue(right.uploadedAt)
        : field === "updated"
          ? dateValue(right.updatedAt)
          : validCount(pageViews?.[right.id]);
      return compareKnownValues(leftValue, rightValue, direction) || leftIndex - rightIndex;
    })
    .map(({ app }) => app);
}

export function formatDate(value) {
  const date = dateValue(value);
  return date ? date.replaceAll("-", "/") : "—";
}

export function formatPageViews(value) {
  const count = validCount(value);
  return count === null ? "—" : new Intl.NumberFormat("en-US").format(count);
}

export async function loadPageViews(workerUrl, fetcher = fetch) {
  try {
    const response = await fetcher(new URL("/api/page-views", workerUrl), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload.counts !== "object" || Array.isArray(payload.counts)) return null;
    const entries = Object.entries(payload.counts).filter(([, value]) => validCount(value) !== null);
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}
