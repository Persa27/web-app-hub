const INCREMENT_PATH = "/increment";
const COUNT_PATH = "/count";

export class PageViewCounter {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS page_views (" +
      "app_id TEXT PRIMARY KEY, total INTEGER NOT NULL CHECK (total >= 0))",
    );
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === INCREMENT_PATH && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Bad request", { status: 400 });
      }

      if (typeof body?.appId !== "string" || body.appId.length === 0) {
        return new Response("Bad request", { status: 400 });
      }

      this.ctx.storage.sql.exec(
        "INSERT INTO page_views (app_id, total) VALUES (?, 1) " +
        "ON CONFLICT(app_id) DO UPDATE SET total = page_views.total + 1",
        body.appId,
      );
      return new Response(null, { status: 204 });
    }

    if (url.pathname === COUNT_PATH && request.method === "GET") {
      const appId = url.searchParams.get("appId");
      if (!appId) return new Response("Bad request", { status: 400 });

      const row = this.ctx.storage.sql
        .exec("SELECT total FROM page_views WHERE app_id = ?", appId)
        .toArray()[0];
      return Response.json({ total: row?.total ?? 0 });
    }

    return new Response("Not found", { status: 404 });
  }
}
