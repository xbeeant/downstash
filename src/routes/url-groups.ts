import type { Context } from "hono";
import { Hono } from "hono";
import type { Db } from "../db.js";
import type { Logger } from "../logger.js";

export interface UrlGroupsDeps {
  db: Db;
  logger: Logger;
}

async function verifyAuth(c: Context, db: Db): Promise<Response | null> {
  const auth = c.req.header("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) {
    return c.json({ error: "missing or empty Authorization bearer token" }, 401);
  }
  const token = auth.replace(/^Bearer\s+/i, "");
  const tokenRow = await db.verifyToken(token);
  if (!tokenRow) {
    return c.json({ error: "invalid token" }, 401);
  }
  await db.updateLastUsed(token);
  return null;
}

export function urlGroupsRoute({ db, logger }: UrlGroupsDeps): Hono {
  const app = new Hono();

  app.post("/v2/url-groups", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const body = await c.req.json();
    if (!body || typeof body !== "object" || !("name" in body) || !("endpoints" in body)) {
      return c.json({ error: "name and endpoints are required" }, 400);
    }

    const name = String(body.name);
    const endpoints = Array.isArray(body.endpoints)
      ? body.endpoints
          .map((e) => {
            if (typeof e === "string") {
              return { url: e };
            }
            if (typeof e === "object" && e && "url" in e) {
              return { url: String(e.url) };
            }
            return null;
          })
          .filter((e): e is { url: string } => e !== null)
      : [];

    await db.upsertUrlGroup(name, endpoints);
    logger.info("url group upserted", { name, endpointCount: endpoints.length });

    return c.json({ name, endpoints });
  });

  app.get("/v2/url-groups", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const groups = await db.listUrlGroups();
    return c.json(groups.map((g) => ({ name: g.name, endpoints: g.endpoints })));
  });

  app.get("/v2/url-groups/:name", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const name = c.req.param("name");
    const group = await db.getUrlGroup(name);
    if (!group) return c.json({ error: "not found" }, 404);

    return c.json({ name: group.name, endpoints: group.endpoints });
  });

  app.delete("/v2/url-groups/:name", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const name = c.req.param("name");
    const deleted = await db.deleteUrlGroup(name);
    if (!deleted) return c.json({ error: "not found" }, 404);

    return c.body(null, 204);
  });

  return app;
}
