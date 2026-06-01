import type { Context } from "hono";
import { Hono } from "hono";
import type { Db, MessageRow } from "../db.ts";

export interface MessagesDeps {
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

export function messagesRoute({ db }: MessagesDeps): Hono {
  const app = new Hono();

  app.get("/v2/messages", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const messages = await db.listMessages();
    return c.json(messages.map(toApiShape));
  });

  app.get("/v2/messages/:messageId", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;
    const id = c.req.param("messageId");
    const row = await db.getMessage(id);
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toApiShape(row));
  });

  app.delete("/v2/messages/:messageId", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;
    const id = c.req.param("messageId");
    const cancelled = await db.cancelMessage(id);
    if (!cancelled) return c.json({ error: "not_found_or_not_pending" }, 404);
    return c.body(null, 204);
  });

  return app;
}

function toApiShape(row: MessageRow) {
  return {
    messageId: row.id,
    url: row.destination,
    method: row.method,
    state: row.status,
    retries: row.retries,
    attempt: row.attempt,
    notBefore: Math.floor(row.notBeforeMs / 1000),
    callback: row.callbackUrl,
    failureCallback: row.failureCallbackUrl,
    lastError: row.lastError,
    createdAt: row.createdMs,
    updatedAt: row.updatedMs,
    queueName: row.queueName,
  };
}
