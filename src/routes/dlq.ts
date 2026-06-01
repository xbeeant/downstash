import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "../db.js";

export interface DlqDeps {
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

export function dlqRoute({ db }: DlqDeps): Hono {
  const app = new Hono();

  app.get("/v2/dlq", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const items = await db.listDlq();
    return c.json(
      items.map((item) => ({
        id: item.id,
        messageId: item.messageId,
        destination: item.destination,
        method: item.method,
        lastError: item.lastError,
        createdAt: item.createdMs,
      })),
    );
  });

  app.get("/v2/dlq/:id", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const item = await db.getDlq(id);
    if (!item) return c.json({ error: "not found" }, 404);

    return c.json({
      id: item.id,
      messageId: item.messageId,
      destination: item.destination,
      method: item.method,
      lastError: item.lastError,
      createdAt: item.createdMs,
    });
  });

  app.delete("/v2/dlq/:id", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const deleted = await db.deleteDlq(id);
    if (!deleted) return c.json({ error: "not found" }, 404);

    return c.body(null, 204);
  });

  app.post("/v2/dlq/:id/requeue", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const newMsgId = await db.requeueDlq(id);
    if (!newMsgId) return c.json({ error: "not found" }, 404);

    return c.json({ messageId: newMsgId });
  });

  return app;
}
