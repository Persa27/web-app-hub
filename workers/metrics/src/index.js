import { PageViewCounter } from "./page-view-counter.js";

export const APP_IDS = Object.freeze([
  "sock-pair",
  "chimo",
  "ballrace",
  "mogumon",
  "treasure",
  "fossil-excavation",
  "math-marathon",
  "quiz-zukan",
  "sentinel-blacklist",
  "shatepon",
  "triad-io",
]);

const HUB_ORIGIN = "https://tamalab-hub.pages.dev";
const APP_ORIGINS = new Map([
  ["https://tamalab-sock-pair.pages.dev", "sock-pair"],
  ["https://tamalab-chimo-race.pages.dev", "chimo"],
  ["https://tamalab-ball-race.pages.dev", "ballrace"],
  ["https://tamalab-mogumon.pages.dev", "mogumon"],
  ["https://tamalab-indoor-treasure-hunt.pages.dev", "treasure"],
  ["https://tamalab-kaseki-excavation.pages.dev", "fossil-excavation"],
  ["https://tamalab-math-marathon.pages.dev", "math-marathon"],
  ["https://tamalab-quiz-zukan.pages.dev", "quiz-zukan"],
  ["https://tamalab-sentinel-blacklist.pages.dev", "sentinel-blacklist"],
  ["https://tamalab-shatepon.pages.dev", "shatepon"],
  ["https://tamalab-triad-io.pages.dev", "triad-io"],
]);
const ALLOWED_ORIGINS = new Set([HUB_ORIGIN, ...APP_ORIGINS.keys()]);
const APP_ID_SET = new Set(APP_IDS);
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(data, status = 200, origin = null) {
  return Response.json(data, {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) },
  });
}

function errorResponse(message, status, origin = null) {
  return jsonResponse({ error: message }, status, origin);
}

function appOriginAllowed(origin, appId) {
  return APP_ORIGINS.get(origin) === appId;
}

function preflight(request, url) {
  const origin = request.headers.get("Origin");
  if (!ALLOWED_ORIGINS.has(origin)) {
    return errorResponse("Origin not allowed", 403);
  }

  const requestedMethod = request.headers.get("Access-Control-Request-Method");
  const allowedMethod = url.pathname === "/api/page-view"
    ? requestedMethod === "POST"
    : url.pathname === "/api/page-views" && requestedMethod === "GET";
  if (!allowedMethod) return errorResponse("Method not allowed", 405, origin);

  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some(header => header !== "content-type")) {
    return errorResponse("Header not allowed", 403, origin);
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function getCount(env, appId) {
  const id = env.PAGE_VIEWS.idFromName(appId);
  const stub = env.PAGE_VIEWS.get(id);
  const response = await stub.fetch(
    "https://page-view-counter/count?appId=" + encodeURIComponent(appId),
  );
  if (!response.ok) throw new Error("Counter unavailable");
  const result = await response.json();
  if (!Number.isSafeInteger(result.total) || result.total < 0) {
    throw new Error("Invalid counter response");
  }
  return result.total;
}

async function increment(env, appId) {
  const id = env.PAGE_VIEWS.idFromName(appId);
  const stub = env.PAGE_VIEWS.get(id);
  const response = await stub.fetch("https://page-view-counter/increment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId }),
  });
  if (!response.ok) throw new Error("Counter unavailable");
}

function clientScript(request, appId) {
  const endpoint = new URL("/api/page-view", request.url).href;
  return [
    "(() => {",
    "  void fetch(" + JSON.stringify(endpoint) + ", {",
    '    method: "POST",',
    '    credentials: "omit",',
    '    headers: { "Content-Type": "application/json" },',
    "    body: JSON.stringify({ appId: " + JSON.stringify(appId) + " }),",
    "    keepalive: true",
    "  }).catch(() => {});",
    "})();",
  ].join("\n");
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (url.pathname === "/client.js") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const appId = url.searchParams.get("app");
      if (!APP_ID_SET.has(appId)) return new Response("Unknown app", { status: 400 });
      return new Response(clientScript(request, appId), {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (url.pathname !== "/api/page-view" && url.pathname !== "/api/page-views") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") return preflight(request, url);
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse("Origin not allowed", 403);
    }

    if (url.pathname === "/api/page-view" && request.method === "POST") {
      if (!APP_ORIGINS.has(origin)) return errorResponse("Origin not allowed", 403);
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
        return errorResponse("JSON required", 415, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return errorResponse("Invalid JSON", 400, origin);
      }
      if (
        !body
        || typeof body !== "object"
        || Array.isArray(body)
        || Object.keys(body).length !== 1
        || !APP_ID_SET.has(body.appId)
      ) {
        return errorResponse("Unknown app", 400, origin);
      }
      if (!appOriginAllowed(origin, body.appId)) {
        return errorResponse("Origin does not match app", 403, origin);
      }

      try {
        await increment(env, body.appId);
      } catch {
        return errorResponse("Counter unavailable", 503, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/page-views" && request.method === "GET") {
      if (origin && origin !== HUB_ORIGIN) {
        return errorResponse("Origin not allowed", 403);
      }
      try {
        const entries = await Promise.all(
          APP_IDS.map(async appId => [appId, await getCount(env, appId)]),
        );
        return jsonResponse({ counts: Object.fromEntries(entries) }, 200, origin);
      } catch {
        return errorResponse("Counters unavailable", 503, origin);
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders(origin),
    });
  },
};

export { PageViewCounter };
export default worker;
