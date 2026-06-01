import type { Context } from "hono";
import { Hono } from "hono";
import type { Logger } from "../logger.ts";
import { executeCommand } from "../redis/commands.ts";
import type { MysqlRedisStore } from "../redis/mysql-store.ts";

export interface RedisDeps {
  store: MysqlRedisStore;
  logger: Logger;
  redisToken: string;
}

type Encoding = "base64" | null;

function checkAuth(c: Context, redisToken: string): Response | null {
  const auth = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match || match[1] !== redisToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

function getEncoding(c: Context): Encoding {
  const enc = c.req.header("upstash-encoding");
  return enc?.toLowerCase() === "base64" ? "base64" : null;
}

export function redisRoute({ store, logger, redisToken }: RedisDeps): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const authErr = checkAuth(c, redisToken);
    if (authErr) return authErr;

    let args: unknown;
    try {
      args = await c.req.json();
    } catch {
      return c.json({ error: "ERR invalid request body" }, 400);
    }
    if (!Array.isArray(args) || args.length === 0) {
      return c.json({ error: "ERR request body must be a non-empty JSON array" }, 400);
    }

    const strArgs = args.map(String);
    const encoding = getEncoding(c);
    const result = await executeCommand(store, strArgs, encoding);

    logger.debug("redis command", { cmd: strArgs[0], args: strArgs.length - 1 });
    return c.json(result);
  });

  app.post("/pipeline", async (c) => {
    const authErr = checkAuth(c, redisToken);
    if (authErr) return authErr;

    let commands: unknown;
    try {
      commands = await c.req.json();
    } catch {
      return c.json({ error: "ERR invalid request body" }, 400);
    }
    if (!Array.isArray(commands)) {
      return c.json({ error: "ERR request body must be a JSON array of command arrays" }, 400);
    }

    const encoding = getEncoding(c);
    const results = await Promise.all(
      commands.map(async (cmd) => {
        if (!Array.isArray(cmd) || cmd.length === 0) {
          return { error: "ERR each pipeline command must be a non-empty array" };
        }
        return await executeCommand(store, cmd.map(String), encoding);
      }),
    );

    logger.debug("redis pipeline", { commands: commands.length });
    return c.json(results);
  });

  app.post("/multi-exec", async (c) => {
    const authErr = checkAuth(c, redisToken);
    if (authErr) return authErr;

    let commands: unknown;
    try {
      commands = await c.req.json();
    } catch {
      return c.json({ error: "ERR invalid request body" }, 400);
    }
    if (!Array.isArray(commands)) {
      return c.json({ error: "ERR request body must be a JSON array of command arrays" }, 400);
    }

    const encoding = getEncoding(c);
    const results = [];
    for (const cmd of commands) {
      if (!Array.isArray(cmd) || cmd.length === 0) {
        return c.json({ error: "ERR each transaction command must be a non-empty array" }, 400);
      }
      const result = await executeCommand(store, cmd.map(String), encoding);
      if ("error" in result) {
        return c.json(result, 400);
      }
      results.push(result);
    }

    logger.debug("redis multi-exec", { commands: commands.length });
    return c.json(results);
  });

  app.on(["GET", "POST"], "/:command{[^/]+}/*", async (c) => {
    const authErr = checkAuth(c, redisToken);
    if (authErr) return authErr;

    const command = c.req.param("command")!;
    const rest = c.req.path.slice(`/${command}/`.length);
    const pathArgs = rest
      .split("/")
      .map(decodeURIComponent)
      .filter((s) => s.length > 0);

    const encoding = getEncoding(c);
    const result = await executeCommand(store, [command, ...pathArgs], encoding);

    logger.debug("redis url command", { cmd: command, args: pathArgs.length });
    return c.json(result);
  });

  app.on(["GET", "POST"], "/:command{[^/]+}", async (c) => {
    const authErr = checkAuth(c, redisToken);
    if (authErr) return authErr;

    const command = c.req.param("command")!;
    const encoding = getEncoding(c);
    const result = await executeCommand(store, [command], encoding);

    logger.debug("redis url command", { cmd: command, args: 0 });
    return c.json(result);
  });

  return app;
}
