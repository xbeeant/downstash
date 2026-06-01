import type { Context } from "hono";
import { Hono } from "hono";
import type { Db, ScheduleRow } from "../db.js";
import { parseDurationMs } from "../duration.js";
import { newMessageId } from "../ids.js";
import type { Logger } from "../logger.js";

export interface SchedulesDeps {
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

function scheduleToApi(s: ScheduleRow) {
  return {
    id: s.id,
    destination: s.destination,
    cron: s.cron,
    method: s.method,
    retries: s.retries,
    timeout: s.timeoutMs,
    callback: s.callbackUrl,
    failureCallback: s.failureCallbackUrl,
    lastRun: s.lastRunMs,
    nextRun: s.nextRunMs,
    createdAt: s.createdMs,
    updatedAt: s.updatedMs,
  };
}

function parseCron(_cron: string): number {
  const now = Date.now();
  const ms = 60000;
  return now + ms;
}

export function schedulesRoute({ db, logger }: SchedulesDeps): Hono {
  const app = new Hono();

  app.post("/v2/schedules/:destination{.+}", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

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

    const cron = c.req.header("upstash-cron");
    if (!cron) {
      return c.json({ error: "Upstash-Cron header is required" }, 400);
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
    const nextRunMs = parseCron(cron);
    await db.insertSchedule({
      id,
      destination,
      cron,
      method,
      body,
      forwardHeaders,
      retries,
      timeoutMs,
      callbackUrl: c.req.header("upstash-callback") ?? null,
      failureCallbackUrl: c.req.header("upstash-failure-callback") ?? null,
      nextRunMs,
    });

    logger.info("schedule created", {
      scheduleId: id,
      destination,
      cron,
    });

    return c.json({ scheduleId: id, url: destination, cron });
  });

  app.get("/v2/schedules", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const schedules = await db.listSchedules();
    return c.json(schedules.map(scheduleToApi));
  });

  app.get("/v2/schedules/:id", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const schedule = await db.getSchedule(id);
    if (!schedule) return c.json({ error: "not found" }, 404);
    return c.json(scheduleToApi(schedule));
  });

  app.delete("/v2/schedules/:id", async (c) => {
    const authErr = await verifyAuth(c, db);
    if (authErr) return authErr;

    const id = c.req.param("id");
    const deleted = await db.deleteSchedule(id);
    if (!deleted) return c.json({ error: "not found" }, 404);
    return c.body(null, 204);
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
