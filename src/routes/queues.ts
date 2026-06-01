import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "../db.js";
import { parseDurationMs } from "../duration.js";
import { newMessageId } from "../ids.js";
import type { Logger } from "../logger.js";

export interface QueuesDeps {
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

export function queuesRoute({ db, logger }: QueuesDeps): Hono {
  const app = new Hono();

  app.post("/v2/queues", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const body = await c.req.json();
    if (!body || typeof body !== "object" || !("name" in body)) {
      return c.json({ error: "name is required" }, 400);
    }

    const name = String(body.name);
    const parallelism = body.parallelism ? Number(body.parallelism) : 1;

    await db.insertQueue(name, parallelism);
    logger.info("queue created", { name, parallelism });

    return c.json({ name, parallelism });
  });

  app.get("/v2/queues", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const queues = await db.listQueues();
    return c.json(queues.map((q) => ({ name: q.name, parallelism: q.parallelism })));
  });

  app.get("/v2/queues/:name", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const name = c.req.param("name");
    const queue = await db.getQueue(name);
    if (!queue) return c.json({ error: "not found" }, 404);

    return c.json({ name: queue.name, parallelism: queue.parallelism });
  });

  app.delete("/v2/queues/:name", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const name = c.req.param("name");
    const deleted = await db.deleteQueue(name);
    if (!deleted) return c.json({ error: "not found" }, 404);

    return c.body(null, 204);
  });

  app.post("/v2/enqueue/:queueName/:destination{.+}", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const queueName = c.req.param("queueName");
    const rawDest = c.req.param("destination");
    if (!rawDest) {
      return c.json({ error: "destination is required" }, 400);
    }
    const destination = decodeURIComponent(rawDest);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(destination);
    } catch {
      return c.json({ error: `invalid destination URL: ${destination}` }, 400);
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return c.json({ error: `unsupported destination protocol: ${parsedUrl.protocol}` }, 400);
    }

    const body = new Uint8Array(await c.req.arrayBuffer());

    const method = (c.req.header("upstash-method") ?? "POST").toUpperCase();
    const retries = parseIntHeader(c.req.header("upstash-retries"), 3, "Upstash-Retries");
    if (retries instanceof Error) return c.json({ error: retries.message }, 400);

    const timeoutMs = parseDurationHeader(
      c.req.header("upstash-timeout"),
      30_000,
      "Upstash-Timeout",
    );
    if (timeoutMs instanceof Error) return c.json({ error: timeoutMs.message }, 400);

    const forwardHeaders = collectForwardHeaders(c.req.raw.headers);

    const id = newMessageId();
    await db.insertMessage({
      id,
      destination,
      method,
      body,
      forwardHeaders,
      retries,
      notBeforeMs: Date.now(),
      timeoutMs,
      callbackUrl: c.req.header("upstash-callback") ?? null,
      failureCallbackUrl: c.req.header("upstash-failure-callback") ?? null,
      queueName,
    });

    logger.info("message enqueued", {
      messageId: id,
      queueName,
      destination,
      method,
      bodyBytes: body.byteLength,
    });

    return c.json({ messageId: id, url: destination, queueName });
  });

  return app;
}

function parseIntHeader(value: string | undefined, fallback: number, name: string): number | Error {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return new Error(`invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseDurationHeader(
  value: string | undefined,
  fallback: number,
  name: string,
): number | Error {
  if (value === undefined) return fallback;
  try {
    return parseDurationMs(value);
  } catch {
    return new Error(`invalid ${name}: ${value}`);
  }
}

function collectForwardHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const contentType = headers.get("content-type");
  if (contentType) {
    out["Content-Type"] = contentType;
  }
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith("upstash-forward-")) {
      const forwarded = key.slice("upstash-forward-".length);
      out[forwarded] = value;
    }
  });
  return out;
}
