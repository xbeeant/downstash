import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "../db.js";

export interface EventsDeps {
  db: Db;
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

export function eventsRoute({ db }: EventsDeps): Hono {
  const app = new Hono();

  app.get("/v2/events", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const events = await db.listEvents();
    return c.json(events);
  });

  app.get("/v2/logs", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const events = await db.listEvents();
    return c.json(events);
  });

  return app;
}
